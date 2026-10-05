import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import {
  addPushNotificationListeners,
  registerForPushNotifications,
  unregisterCurrentPushDevice,
} from '../services/pushNotificationService';
import { registerPushDevice, removePushDevice } from '../api/notificationApi';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  clearLastNotificationResponseAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../api/notificationApi', () => ({
  registerPushDevice: jest.fn(),
  removePushDevice: jest.fn(),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { easConfig: undefined, expoConfig: null },
}));

const mockGetPermissions = Notifications.getPermissionsAsync as jest.Mock;
const mockRequestPermissions = Notifications.requestPermissionsAsync as jest.Mock;
const mockGetExpoPushToken = Notifications.getExpoPushTokenAsync as jest.Mock;
const mockGetLastResponse = Notifications.getLastNotificationResponseAsync as jest.Mock;
const mockRegisterPushDevice = registerPushDevice as jest.MockedFunction<typeof registerPushDevice>;
const mockRemovePushDevice = removePushDevice as jest.MockedFunction<typeof removePushDevice>;
const mockConstants = Constants as unknown as {
  easConfig: { projectId: string } | undefined;
  expoConfig: null;
};

describe('pushNotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConstants.easConfig = { projectId: 'test-eas-project' };
    mockRemovePushDevice.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockConstants.easConfig = undefined;
  });

  it('does not request permission again or register a device after denial', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'denied', granted: false });

    await expect(registerForPushNotifications('auth-token')).resolves.toBe('denied');

    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockRegisterPushDevice).not.toHaveBeenCalled();
  });

  it('requests undetermined permission, registers through the authenticated API, and removes on logout', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'undetermined', granted: false });
    mockRequestPermissions.mockResolvedValue({ status: 'granted', granted: true });
    mockGetExpoPushToken.mockResolvedValue({ data: 'ExponentPushToken[test]' });
    mockRegisterPushDevice.mockResolvedValue({
      deviceId: 17,
      platform: 'ios',
      createdAt: '2026-10-05T10:00:00Z',
    });

    await expect(registerForPushNotifications('auth-token')).resolves.toBe('registered');
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    expect(mockGetExpoPushToken).toHaveBeenCalledWith({ projectId: 'test-eas-project' });
    expect(mockRegisterPushDevice).toHaveBeenCalledWith(
      'auth-token',
      'ExponentPushToken[test]',
      expect.any(String),
    );

    await unregisterCurrentPushDevice('auth-token');
    expect(mockRemovePushDevice).toHaveBeenCalledWith(17, 'auth-token');
  });

  it('does not request permission when no EAS project ID is configured', async () => {
    mockConstants.easConfig = undefined;

    await expect(registerForPushNotifications('auth-token')).resolves.toBe('unavailable');

    expect(mockGetPermissions).not.toHaveBeenCalled();
    expect(mockRegisterPushDevice).not.toHaveBeenCalled();
  });

  it('forwards the cold-start notification response and clears the stored response', async () => {
    mockGetLastResponse.mockResolvedValue({
      notification: {
        request: {
          identifier: 'response-1',
          content: { data: { type: 'NEW_MESSAGE', conversationId: 91 } },
        },
      },
    });
    const onResponse = jest.fn();
    const cleanup = addPushNotificationListeners({ onReceived: jest.fn(), onResponse });

    await Promise.resolve();
    await Promise.resolve();

    expect(onResponse).toHaveBeenCalledWith(
      { type: 'NEW_MESSAGE', conversationId: 91 },
      'response-1',
    );
    expect(Notifications.clearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
    cleanup();
  });
});