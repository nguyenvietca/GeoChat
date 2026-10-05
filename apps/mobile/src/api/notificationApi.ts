import { apiRequest } from './client';
import {
  AppNotification,
  NotificationListResponse,
  UnreadCountResponse,
} from '../types/notification';

export function getNotifications(token: string) {
  return apiRequest<NotificationListResponse>('/api/v1/notifications', { token });
}

export function getUnreadNotificationCount(token: string) {
  return apiRequest<UnreadCountResponse>('/api/v1/notifications/unread-count', { token });
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