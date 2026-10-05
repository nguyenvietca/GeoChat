import { AppNotification } from '../types/notification';

export type FriendNotificationTab = 'friends' | 'incoming';
export type PushNotificationDestination =
  | { screen: 'friends'; tab: FriendNotificationTab }
  | { screen: 'chat'; conversationId: number }
  | { screen: 'notifications' };

export function getNotificationDestination(notification: AppNotification): FriendNotificationTab | null {
  if (notification.referenceType !== 'FRIEND_REQUEST' || notification.referenceId <= 0) {
    return null;
  }

  switch (notification.type) {
    case 'FRIEND_REQUEST_RECEIVED':
      return 'incoming';
    case 'FRIEND_REQUEST_ACCEPTED':
      return 'friends';
    case 'NEW_MESSAGE':
      return null;
  }
}

export function getPushNotificationDestination(data: unknown): PushNotificationDestination {
  if (typeof data !== 'object' || data === null) {
    return { screen: 'notifications' };
  }

  const payload = data as Record<string, unknown>;
  switch (payload.type) {
    case 'FRIEND_REQUEST_RECEIVED':
      return { screen: 'friends', tab: 'incoming' };
    case 'FRIEND_REQUEST_ACCEPTED':
      return { screen: 'friends', tab: 'friends' };
    case 'NEW_MESSAGE':
      return Number.isSafeInteger(payload.conversationId) && Number(payload.conversationId) > 0
        ? { screen: 'chat', conversationId: Number(payload.conversationId) }
        : { screen: 'notifications' };
    default:
      return { screen: 'notifications' };
  }
}
