export type NotificationType =
  | 'FRIEND_REQUEST_RECEIVED'
  | 'FRIEND_REQUEST_ACCEPTED'
  | 'NEW_MESSAGE';

export type NotificationReferenceType = 'FRIEND_REQUEST' | 'MESSAGE';

export type AppNotification = {
  id: number;
  recipientId: number;
  type: NotificationType;
  title: string;
  message: string;
  referenceType: NotificationReferenceType;
  referenceId: number;
  conversationId: number | null;
  read: boolean;
  createdAt: string;
  readAt: string | null;
};

export type NotificationListResponse = {
  items: AppNotification[];
  unreadCount: number;
  total?: number;
  limit?: number;
  offset?: number;
  hasMore?: boolean;
};

export type UnreadCountResponse = {
  unreadCount: number;
};