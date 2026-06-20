import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveSession, clearSession, getAccessToken, tryRefreshSession, revokeSession, MOCK_TOKEN,
} from './session';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    _map: map,
  };
}

let storage: ReturnType<typeof memoryStorage>;

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  clearSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saveSession / clearSession', () => {
  it('keeps the access token in memory and only persists the refresh token', () => {
    saveSession('access-1', 'refresh-1');
    expect(getAccessToken()).toBe('access-1');
    expect(storage._map.has('fv_refresh')).toBe(true);
    expect([...storage._map.values()]).not.toContain('access-1');
  });

  it('persists the demo sentinel under the legacy key', () => {
    saveSession(MOCK_TOKEN);
    expect(storage.getItem('finvault_token')).toBe(MOCK_TOKEN);
    expect(storage._map.has('fv_refresh')).toBe(false);
  });

  it('clearSession wipes memory and storage', () => {
    saveSession('access-1', 'refresh-1');
    clearSession();
    expect(getAccessToken()).toBeNull();
    expect(storage._map.size).toBe(0);
  });
});

describe('tryRefreshSession', () => {
  it('rotates the pair via /api/auth/refresh', async () => {
    saveSession('old-access', 'refresh-1');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'new-access', refreshToken: 'refresh-2' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const token = await tryRefreshSession();
    expect(token).toBe('new-access');
    expect(storage.getItem('fv_refresh')).toBe('refresh-2');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/refresh', expect.objectContaining({ method: 'POST' }));
  });

  it('clears the session when the server rejects the refresh token', async () => {
    saveSession('old-access', 'refresh-1');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));

    expect(await tryRefreshSession()).toBeNull();
    expect(storage._map.has('fv_refresh')).toBe(false);
  });

  it('keeps the refresh token on network failure (offline)', async () => {
    saveSession('old-access', 'refresh-1');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    expect(await tryRefreshSession()).toBeNull();
    expect(storage.getItem('fv_refresh')).toBe('refresh-1');
  });

  it('restores the demo sentinel without any network call', async () => {
    storage.setItem('finvault_token', MOCK_TOKEN);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await tryRefreshSession()).toBe(MOCK_TOKEN);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('migrates a legacy access token once', async () => {
    storage.setItem('finvault_token', 'legacy-access');
    expect(await tryRefreshSession()).toBe('legacy-access');
    expect(storage._map.has('finvault_token')).toBe(false);
  });
});

describe('revokeSession', () => {
  it('POSTs the stored refresh token to /api/auth/logout', async () => {
    saveSession('access-1', 'refresh-1');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await revokeSession();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({
      body: JSON.stringify({ refreshToken: 'refresh-1' }),
    }));
  });

  it('does nothing without a stored refresh token', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await revokeSession();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
