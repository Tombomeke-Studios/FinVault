// Saved accounts + per-account biometric credentials (#121).
//
// How biometric sign-in is bound to an account: a phone never hands an app the
// fingerprint or face itself — Android/iOS keep those templates and only answer
// "the enrolled owner passed". So, like a banking app, we bind the *account* to
// *this phone*: while signed in, the server issues a random device secret
// (POST /auth/biometric/enroll) and we store it in the hardware keystore with
// `requireAuthentication`, which means the OS fingerprint/face prompt must
// succeed before the keystore releases it. Adding a new fingerprint on Android
// invalidates the key, so linking has to be done again.

import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { authenticateBiometric } from './biometrics';
import {
  accountStorageKey, parseAccounts, removeAccount, updateAccount, upsertAccount, type SavedAccount,
} from './lib/accounts';

const LIST_KEY = 'finvault.accounts';
const ACTIVE_KEY = 'finvault.activeAccount';
const credKey = (email: string) => `finvault.bio.${accountStorageKey(email)}`;
const deviceKey = (email: string) => `finvault.biodev.${accountStorageKey(email)}`;

export interface BiometricCredential { deviceId: string; secret: string }

// ── Saved-accounts list ────────────────────────────────────────────────────

export async function loadAccounts(): Promise<SavedAccount[]> {
  try { return parseAccounts(await SecureStore.getItemAsync(LIST_KEY)); } catch { return []; }
}

async function saveAccounts(list: SavedAccount[]): Promise<SavedAccount[]> {
  try { await SecureStore.setItemAsync(LIST_KEY, JSON.stringify(list)); } catch { /* best effort */ }
  return list;
}

/** Records a successful sign-in: the account moves to the top and becomes active. */
export async function rememberAccount(patch: Partial<SavedAccount> & { email: string }): Promise<SavedAccount[]> {
  const list = await saveAccounts(upsertAccount(await loadAccounts(), patch));
  try { await SecureStore.setItemAsync(ACTIVE_KEY, patch.email.trim()); } catch { /* best effort */ }
  return list;
}

export async function patchAccount(email: string, patch: Partial<SavedAccount>): Promise<SavedAccount[]> {
  return saveAccounts(updateAccount(await loadAccounts(), email, patch));
}

/** Removes the account from this phone, including its biometric credential. */
export async function forgetAccount(email: string): Promise<SavedAccount[]> {
  await clearBiometricCredential(email);
  if ((await getActiveEmail())?.toLowerCase() === email.trim().toLowerCase()) {
    try { await SecureStore.deleteItemAsync(ACTIVE_KEY); } catch { /* best effort */ }
  }
  return saveAccounts(removeAccount(await loadAccounts(), email));
}

export async function getActiveEmail(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(ACTIVE_KEY); } catch { return null; }
}

// ── Biometric credential, one per account ──────────────────────────────────

/**
 * Hardware binding needs the keystore's user-authentication mode. Expo Go on
 * iOS lacks the Face ID usage string it requires, so there (and on devices
 * without strong biometrics) we fall back to an explicit OS prompt before
 * every read: still a real biometric check, but the secret itself is only
 * keystore-encrypted, not biometric-locked.
 */
export function hardwareBindingAvailable(): boolean {
  if (Platform.OS === 'ios' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  try { return SecureStore.canUseBiometricAuthentication(); } catch { return false; }
}

/**
 * Stores the device credential for `email`. On Android the keystore write
 * itself shows the fingerprint prompt (the "scan to link" step); on iOS and in
 * the fallback mode we show it explicitly first. Returns false if the user
 * cancelled or the keystore refused.
 */
export async function storeBiometricCredential(email: string, cred: BiometricCredential, prompt: string): Promise<boolean> {
  const value = JSON.stringify(cred);
  try {
    if (hardwareBindingAvailable()) {
      if (Platform.OS === 'ios' && !(await authenticateBiometric(prompt))) return false;
      await SecureStore.setItemAsync(credKey(email), value, { requireAuthentication: true, authenticationPrompt: prompt });
    } else {
      if (!(await authenticateBiometric(prompt))) return false;
      await SecureStore.setItemAsync(credKey(email), value);
    }
    await SecureStore.setItemAsync(deviceKey(email), cred.deviceId);
    return true;
  } catch {
    return false;
  }
}

export type ReadResult =
  | { ok: true; cred: BiometricCredential }
  | { ok: false; reason: 'cancelled' | 'missing' };

/** Shows the OS biometric prompt and returns the account's device credential. */
export async function readBiometricCredential(email: string, prompt: string): Promise<ReadResult> {
  try {
    let raw: string | null;
    if (hardwareBindingAvailable()) {
      raw = await SecureStore.getItemAsync(credKey(email), { requireAuthentication: true, authenticationPrompt: prompt });
    } else {
      if (!(await authenticateBiometric(prompt))) return { ok: false, reason: 'cancelled' };
      raw = await SecureStore.getItemAsync(credKey(email));
    }
    if (!raw) return { ok: false, reason: 'missing' };
    const cred = JSON.parse(raw);
    if (typeof cred?.deviceId !== 'string' || typeof cred?.secret !== 'string') return { ok: false, reason: 'missing' };
    return { ok: true, cred };
  } catch (e: any) {
    // Cancelling the prompt throws; so does a key invalidated by a newly added
    // fingerprint. Only the second one means the link is gone for good.
    const msg = String(e?.message || '').toLowerCase();
    return { ok: false, reason: msg.includes('cancel') ? 'cancelled' : 'missing' };
  }
}

/** The (non-secret) device id, readable without a prompt so it can be revoked. */
export async function biometricDeviceId(email: string): Promise<string | null> {
  try { return await SecureStore.getItemAsync(deviceKey(email)); } catch { return null; }
}

export async function clearBiometricCredential(email: string): Promise<void> {
  try { await SecureStore.deleteItemAsync(credKey(email), { requireAuthentication: true }); } catch { /* not there */ }
  try { await SecureStore.deleteItemAsync(credKey(email)); } catch { /* not there */ }
  try { await SecureStore.deleteItemAsync(deviceKey(email)); } catch { /* not there */ }
}

/** A readable name for this phone in the server's device list. */
export function thisDeviceName(): string {
  const model = (Constants as any).deviceName as string | undefined;
  if (model) return model.slice(0, 60);
  return Platform.OS === 'ios' ? 'iPhone' : 'Android phone';
}
