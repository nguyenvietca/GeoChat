import {
  getNotifications,
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

    expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/notifications', { token });
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
});
