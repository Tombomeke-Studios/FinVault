// OS biometric prompt (expo-local-authentication): Face ID / Touch ID /
// Android fingerprint and face unlock. This only answers "the phone's enrolled
// owner passed"; tying that to a FinVault account is src/accounts.ts (#121).

import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

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
      disableDeviceFallback: true, // a phone PIN is not a biometric
    });
    return result.success;
  } catch {
    return false;
  }
}

/** What to call the sensor in copy: "Face ID", "Fingerprint", … */
export async function biometricLabel(): Promise<string> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    if (Platform.OS === 'ios') return face ? 'Face ID' : 'Touch ID';
    if (finger) return 'Fingerprint';
    if (face) return 'Face unlock';
  } catch { /* fall through */ }
  return 'Biometrics';
}
