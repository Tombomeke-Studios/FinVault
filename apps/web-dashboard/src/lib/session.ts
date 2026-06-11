// Web session handling (#3/#4) — mirrors apps/mobile/src/session.ts.
//
// The access token lives **in memory only**; what persists is the rotating
// refresh token (localStorage `fv_refresh`). Trade-off: an httpOnly cookie
// would also defeat XSS token theft but needs cookie handling in the gateway —
// tracked as a hardening follow-up in docs/security.md. The offline demo
// session keeps using the legacy localStorage key so demo mode survives
// reloads without pretending to be a real credential.

const REFRESH_KEY = 'fv_refresh';
const LEGACY_ACCESS_KEY = 'finvault_token'; // pre-refresh-flow storage, migrated on boot
export const MOCK_TOKEN = 'mock-token-abc';

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function saveSession(access: string, refresh?: string | null): void {
  accessToken = access;
  try {
    if (access === MOCK_TOKEN) {
      // Demo mode: persist the sentinel so a reload stays in demo mode.
      localStorage.setItem(LEGACY_ACCESS_KEY, access);
      return;
    }
    localStorage.removeItem(LEGACY_ACCESS_KEY);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  } catch { /* storage unavailable (private mode) — in-memory still works */ }
}

export function clearSession(): void {
  accessToken = null;
  try {
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(LEGACY_ACCESS_KEY);
  } catch { /* ignore */ }
}

/**
 * Boot/expiry recovery: exchange the stored refresh token for a fresh pair.
 * Returns the new access token, the demo sentinel, a migrated legacy token,
 * or null when there is no recoverable session. A *network* failure keeps the
 * stored refresh token for a later attempt; a rejected token clears it.
 */
export async function tryRefreshSession(): Promise<string | null> {
  let refreshToken: string | null = null;
  try { refreshToken = localStorage.getItem(REFRESH_KEY); } catch { /* ignore */ }

  if (!refreshToken) {
    try {
      const legacy = localStorage.getItem(LEGACY_ACCESS_KEY);
      if (legacy === MOCK_TOKEN) {
        accessToken = legacy;
        return legacy;
      }
      if (legacy) {
        // One-time migration: use the old stored access token until it
        // expires; the next real login stores a refresh token instead.
        localStorage.removeItem(LEGACY_ACCESS_KEY);
        accessToken = legacy;
        return legacy;
      }
    } catch { /* ignore */ }
    return null;
  }

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearSession();
      return null;
    }
    const pair = await res.json();
    saveSession(pair.accessToken, pair.refreshToken);
    return pair.accessToken as string;
  } catch {
    return null; // offline — keep the stored refresh token for later
  }
}

/** Best-effort server-side revocation of the stored refresh token (#4). */
export async function revokeSession(): Promise<void> {
  let refreshToken: string | null = null;
  try { refreshToken = localStorage.getItem(REFRESH_KEY); } catch { /* ignore */ }
  if (!refreshToken) return;
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch { /* offline — clearSession still removes the local copy */ }
}
