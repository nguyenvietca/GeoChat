import { apiRequest } from './client';
import {
  AppNotification,
  NotificationListResponse,
  UnreadCountResponse,
} from '../types/notification';

export type PushDeviceRegistration = {
  deviceId: number;
  platform: 'ios' | 'android';
  createdAt: string;
};

export function getNotifications(token: string, limit = 20, offset = 0) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return apiRequest<NotificationListResponse>(`/api/v1/notifications?${params}`, { token });
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

export function registerPushDevice(token: string, pushToken: string, platform: 'ios' | 'android') {
  return apiRequest<PushDeviceRegistration>('/api/v1/notifications/devices', {
    method: 'POST',
    body: { token: pushToken, platform },
    token,
  });
}

export function removePushDevice(deviceId: number, token: string) {
  return apiRequest<void>(`/api/v1/notifications/devices/${deviceId}`, {
    method: 'DELETE',
    token,
  });
}