/**
 * Where the mobile app finds the FinVault gateway.
 *
 * The fallback used to be one hard-coded LAN address (`192.168.0.6`). On any
 * other network or machine the app could not reach the backend, and because
 * login falls back to the offline demo, it looked like it worked — with fake
 * data. Now:
 *
 * 1. `EXPO_PUBLIC_API_URL` wins when it is set (production builds, tunnels).
 * 2. In development, the gateway runs on the same machine as the Expo dev
 *    server, so the dev server's host (Expo's `hostUri`, e.g.
 *    `192.168.1.20:8081`) with the gateway port is the right address on any
 *    network. A tunnel host (`*.exp.direct`) only forwards Metro, never the
 *    gateway, so it is skipped.
 * 3. Otherwise `localhost`, which is right for a simulator on the same machine.
 */
export const GATEWAY_PORT = 8000;

export function resolveApiUrl(envUrl?: string | null, hostUri?: string | null, port = GATEWAY_PORT): string {
  const fromEnv = envUrl?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const host = hostUri?.trim().replace(/^[a-z]+:\/\//i, '').split('/')[0].split(':')[0];
  if (host && !host.endsWith('.exp.direct')) return `http://${host}:${port}`;

  return `http://localhost:${port}`;
}
