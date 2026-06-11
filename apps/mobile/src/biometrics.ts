// Real biometric gate (#7) — expo-local-authentication wraps Face ID /
// Touch ID / Android fingerprint. The opt-in preference lives in the
// keystore next to the session tokens.
//
// Known gap (documented in docs/security.md): SecureStore's
// `requireAuthentication` option would additionally hardware-encrypt the
// refresh token behind biometrics, but it needs a dev build (config plugin) —
// not available in Expo Go.

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const PREF_KEY = 'finvault.biometricLogin';

/** Device has biometric hardware *and* the user enrolled in it. */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync())
      && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** Shows the system biometric prompt; resolves false on cancel/failure. */
export async function authenticateBiometric(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Use password',
    });
    return result.success;
  } catch {
    return false;
  }
}

export async function getBiometricPref(): Promise<boolean> {
  try { return (await SecureStore.getItemAsync(PREF_KEY)) === '1'; } catch { return false; }
}

export async function setBiometricPref(enabled: boolean): Promise<void> {
  try { await SecureStore.setItemAsync(PREF_KEY, enabled ? '1' : '0'); } catch { /* best effort */ }
}
