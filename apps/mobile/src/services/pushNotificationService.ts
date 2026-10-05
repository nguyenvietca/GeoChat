import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerPushDevice, removePushDevice } from '../api/notificationApi';

type PushRegistrationStatus = 'registered' | 'denied' | 'unavailable';
type PushNotificationHandlers = {
  onReceived: () => void;
  onResponse: (data: unknown, identifier: string) => void;
};

let registeredDeviceId: number | null = null;
let registrationRevision = 0;
let pushTokenSubscription: ReturnType<typeof Notifications.addPushTokenListener> | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(authToken: string): Promise<PushRegistrationStatus> {
  const revision = ++registrationRevision;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return 'unavailable';
  }
  // @ts-expect-error Expo replaces this public app-specific variable when bundling.
  const configuredProjectId: string | undefined = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const projectId = configuredProjectId || Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    return 'unavailable';
  }

  try {
    let permission = await Notifications.getPermissionsAsync();
    if (permission.status === 'undetermined') {
      permission = await Notifications.requestPermissionsAsync();
    }
    if (permission.status !== 'granted' && !permission.granted) {
      return 'denied';
    }

    const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (revision !== registrationRevision) {
      return 'unavailable';
    }

    const device = await registerPushDevice(
      authToken,
      pushToken,
      Platform.OS === 'android' ? 'android' : 'ios',
    );
    if (revision !== registrationRevision) {
      void removePushDevice(device.deviceId, authToken).catch(() => undefined);
      return 'unavailable';
    }

    const previousDeviceId = registeredDeviceId;
    registeredDeviceId = device.deviceId;
    if (previousDeviceId !== null && previousDeviceId !== device.deviceId) {
      void removePushDevice(previousDeviceId, authToken).catch(() => undefined);
    }
    if (!pushTokenSubscription) {
      pushTokenSubscription = Notifications.addPushTokenListener(() => {
        void registerForPushNotifications(authToken);
      });
    }
    return 'registered';
  } catch {
    return 'unavailable';
  }
}

export async function unregisterCurrentPushDevice(authToken: string): Promise<void> {
  registrationRevision += 1;
  pushTokenSubscription?.remove();
  pushTokenSubscription = null;
  const deviceId = registeredDeviceId;
  registeredDeviceId = null;
  if (deviceId === null) {
    return;
  }

  await removePushDevice(deviceId, authToken);
}

export function addPushNotificationListeners(handlers: PushNotificationHandlers): () => void {
  const onResponse = (response: Notifications.NotificationResponse | null) => {
    if (!response) {
      return;
    }
    handlers.onResponse(
      response.notification.request.content.data,
      response.notification.request.identifier,
    );
    void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  };

  const receivedSubscription = Notifications.addNotificationReceivedListener(handlers.onReceived);
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(onResponse);
  void Notifications.getLastNotificationResponseAsync().then(onResponse).catch(() => undefined);

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}