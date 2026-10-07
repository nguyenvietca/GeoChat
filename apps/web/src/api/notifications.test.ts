import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './client';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications';

vi.mock('./client', () => ({ apiRequest: vi.fn() }));
const mockApiRequest = vi.mocked(apiRequest);

describe('notification API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads notifications using the bounded limit/offset contract', () => {
    getNotifications('jwt');
    getNotifications('jwt', 20, 40);

    expect(mockApiRequest).toHaveBeenNthCalledWith(1, '/api/v1/notifications?limit=20&offset=0', { token: 'jwt' });
    expect(mockApiRequest).toHaveBeenNthCalledWith(2, '/api/v1/notifications?limit=20&offset=40', { token: 'jwt' });
  });

  it('loads unread count and marks one or all notifications as read', () => {
    getUnreadNotificationCount('jwt');
    markNotificationRead(12, 'jwt');
    markAllNotificationsRead('jwt');

    expect(mockApiRequest).toHaveBeenNthCalledWith(1, '/api/v1/notifications/unread-count', { token: 'jwt' });
    expect(mockApiRequest).toHaveBeenNthCalledWith(2, '/api/v1/notifications/12/read', { method: 'POST', token: 'jwt' });
    expect(mockApiRequest).toHaveBeenNthCalledWith(3, '/api/v1/notifications/read-all', { method: 'POST', token: 'jwt' });
  });
});