import {
  getNotifications,
  registerPushDevice,
  removePushDevice,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notificationApi';
import { apiRequest } from '../api/client';

jest.mock('../api/client', () => ({
  apiRequest: jest.fn(),
}));

const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;
const token = 'test-token';

describe('notificationApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the authenticated notification list', async () => {
    await getNotifications(token);
    await getNotifications(token, 20, 40);

    expect(mockApiRequest).toHaveBeenNthCalledWith(1, '/api/v1/notifications?limit=20&offset=0', { token });
    expect(mockApiRequest).toHaveBeenNthCalledWith(2, '/api/v1/notifications?limit=20&offset=40', { token });
  });

  it('loads the authenticated unread count', async () => {
    await getUnreadNotificationCount(token);

    expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/notifications/unread-count', { token });
  });

  it('marks one notification as read', async () => {
    await markNotificationRead(12, token);

    expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/notifications/12/read', {
      method: 'POST',
      token,
    });
  });

  it('marks all notifications as read', async () => {
    await markAllNotificationsRead(token);

    expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/notifications/read-all', {
      method: 'POST',
      token,
    });
  });

  it('registers a push device using the authenticated API client', async () => {
    await registerPushDevice(token, 'ExponentPushToken[test]', 'ios');

    expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/notifications/devices', {
      method: 'POST',
      body: { token: 'ExponentPushToken[test]', platform: 'ios' },
      token,
    });
  });

  it('removes only the selected push device using the authenticated API client', async () => {
    await removePushDevice(42, token);

    expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/notifications/devices/42', {
      method: 'DELETE',
      token,
    });
  });
});
