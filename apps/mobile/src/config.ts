/**
 * Runtime configuration for the mobile app.
 *
 * EXPO_PUBLIC_* variables are inlined by Metro at bundle time, so whatever is
 * set when `expo start` / `eas build` runs is what the app talks to:
 *   - Expo Go:   apps/mobile/.env  → EXPO_PUBLIC_API_URL=...
 *   - EAS build: the profile's `env` block in eas.json
 * Without it the app uses DEFAULT_API_URL, the home server's API gateway
 * (see the infra repo's README → Addresses).
 */

export const DEFAULT_API_URL = 'http://192.168.0.117:8000';

/** Normalises a configured base URL: trims whitespace and trailing slashes. */
export function resolveApiUrl(raw: string | undefined, fallback = DEFAULT_API_URL): string {
  const value = (raw ?? '').trim().replace(/\/+$/, '');
  return value || fallback;
}

/**
 * Offline demo mode (mock data when the backend can't be reached) is a dev
 * convenience. In a release build it would hide a broken connection behind
 * fake balances, so it is off unless explicitly enabled.
 */
export function resolveDemoMode(raw: string | undefined, isDev: boolean): boolean {
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return isDev;
}

export const API_URL = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL);

export const DEMO_MODE_ENABLED = resolveDemoMode(
  process.env.EXPO_PUBLIC_DEMO_MODE,
  typeof __DEV__ !== 'undefined' && __DEV__,
);

/** Shown when a request fails at the network level (server down, wrong URL, off-LAN). */
export const UNREACHABLE_MESSAGE = `Can't reach the FinVault server (${API_URL}). Check your connection and try again.`;
