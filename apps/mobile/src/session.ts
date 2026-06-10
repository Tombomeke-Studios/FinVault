import * as SecureStore from 'expo-secure-store';

/**
 * Persistent session storage backed by the platform keystore
 * (iOS Keychain / Android Keystore via expo-secure-store).
 * Tokens never touch AsyncStorage or plain files.
 */

const ACCESS_KEY = 'finvault.accessToken';
const REFRESH_KEY = 'finvault.refreshToken';

export interface StoredSession {
  accessToken: string | null;
  refreshToken: string | null;
}

export async function saveSession(accessToken: string, refreshToken?: string | null): Promise<void> {
  try {
    await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
    if (refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  } catch (e) {
    console.warn('[session] Failed to persist session:', e);
  }
}

export async function loadSession(): Promise<StoredSession> {
  try {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
    ]);
    return { accessToken, refreshToken };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

export async function clearSession(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
    ]);
  } catch (e) {
    console.warn('[session] Failed to clear session:', e);
  }
}

/**
 * Exchange the stored refresh token for a new token pair via the API.
 * Returns the new access token (already persisted) or null.
 */
export async function tryRefreshSession(apiUrl: string): Promise<string | null> {
  const { refreshToken } = await loadSession();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${apiUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      await clearSession();
      return null;
    }
    const pair = await res.json();
    await saveSession(pair.accessToken, pair.refreshToken);
    return pair.accessToken as string;
  } catch {
    return null; // offline — keep the stored session for later
  }
}

/** Best-effort server-side revocation of the stored refresh token. */
export async function revokeSession(apiUrl: string): Promise<void> {
  const { refreshToken } = await loadSession();
  if (!refreshToken) return;
  try {
    await fetch(`${apiUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // offline — local clearSession still removes the device copy
  }
}
