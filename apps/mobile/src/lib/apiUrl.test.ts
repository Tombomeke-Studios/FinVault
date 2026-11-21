import { describe, expect, it } from 'vitest';
import { resolveApiUrl } from './apiUrl';

describe('resolveApiUrl', () => {
  it('uses EXPO_PUBLIC_API_URL when it is set, without a trailing slash', () => {
    expect(resolveApiUrl('https://api.finvault.app/', '192.168.1.20:8081')).toBe('https://api.finvault.app');
  });

  it('ignores an empty or blank EXPO_PUBLIC_API_URL', () => {
    expect(resolveApiUrl('   ', '192.168.1.20:8081')).toBe('http://192.168.1.20:8000');
  });

  it('points at the Expo dev server host on the gateway port', () => {
    expect(resolveApiUrl(undefined, '10.0.0.7:8081')).toBe('http://10.0.0.7:8000');
  });

  it('accepts a hostUri that carries a scheme or a path', () => {
    expect(resolveApiUrl(undefined, 'exp://10.0.0.7:8081/--/home')).toBe('http://10.0.0.7:8000');
  });

  it('skips a tunnel host, which never forwards the gateway', () => {
    expect(resolveApiUrl(undefined, 'abc-anonymous-8081.exp.direct')).toBe('http://localhost:8000');
  });

  it('falls back to localhost when nothing is known', () => {
    expect(resolveApiUrl(undefined, null)).toBe('http://localhost:8000');
  });

  it('never returns the old hard-coded LAN address', () => {
    expect(resolveApiUrl(undefined, undefined)).not.toContain('192.168.0.6');
  });
});
