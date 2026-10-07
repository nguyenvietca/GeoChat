import { apiRequest } from './client';
import { AppNotification, NotificationListResponse, UnreadNotificationCount } from '../types';

export function getNotifications(token: string, limit = 20, offset = 0) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return apiRequest<NotificationListResponse>(`/api/v1/notifications?${params}`, { token });
}

export function getUnreadNotificationCount(token: string) {
  return apiRequest<UnreadNotificationCount>('/api/v1/notifications/unread-count', { token });
}

export function markNotificationRead(notificationId: number, token: string) {
  return apiRequest<AppNotification>(`/api/v1/notifications/${notificationId}/read`, {
    method: 'POST',
    token,
  });
}

export function markAllNotificationsRead(token: string) {
  return apiRequest<NotificationListResponse>('/api/v1/notifications/read-all', {
    method: 'POST',
    token,
  });
}