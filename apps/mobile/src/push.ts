import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'b944a054-e3b9-45b3-b052-2eac50ecfea3',
    });

    return tokenData.data;
  } catch {
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
