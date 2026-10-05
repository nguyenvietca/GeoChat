import { AppNotification } from '../types/notification';

export type FriendNotificationTab = 'friends' | 'incoming';

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
