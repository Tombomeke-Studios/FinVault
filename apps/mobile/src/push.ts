import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function isExpoGoClient(): boolean {
  const appOwnership = (Constants as { appOwnership?: string }).appOwnership;
  const executionEnvironment = (Constants as { executionEnvironment?: string }).executionEnvironment;

  return appOwnership === 'expo' || executionEnvironment === 'storeClient';
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (isExpoGoClient()) {
      console.warn('[Push] Remote push notifications are not available in Expo Go. Use an EAS development build or a standalone build instead.');
      return null;
    }

    const existing = await Notifications.getPermissionsAsync();
    let canProceed = (existing as any).status === 'granted' || (existing as any).granted;

    if (!canProceed) {
      const requested = await Notifications.requestPermissionsAsync();
      canProceed = (requested as any).status === 'granted' || (requested as any).granted;
    }

    if (!canProceed) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'FinVault',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('[Push] No EAS projectId found — push registration skipped');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (err) {
    console.warn('[Push] Registration failed:', err);
    return null;
  }
}

export async function sendTokenToServer(apiUrl: string, authToken: string, pushToken: string) {
  try {
    await fetch(`${apiUrl}/api/users/push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ pushToken }),
    });
  } catch { /* best effort */ }
}
