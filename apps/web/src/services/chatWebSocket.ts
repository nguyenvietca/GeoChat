import { AppNotification, ChatMessage, NotificationReferenceType, NotificationType } from '../types';
import {
  buildWebSocketUrl,
  disconnectAllStompConnections,
  StompConnectionState,
  subscribeToStompDestination,
} from './stompConnection';

export type ChatConnectionState = StompConnectionState;

export type ChatWebSocketHandlers = {
  onMessage: (message: ChatMessage) => void;
  onStateChange: (state: ChatConnectionState) => void;
};

export function buildChatWebSocketUrl() {
  return buildWebSocketUrl();
}

export function subscribeToConversation(
  conversationId: number,
  token: string,
  handlers: ChatWebSocketHandlers,
) {
  return subscribeToStompDestination(token, `/topic/chat/${conversationId}`, {
    onStateChange: handlers.onStateChange,
    onFrame: (body) => {
      const message = parseChatMessage(body);
      if (message?.conversationId === conversationId) {
        handlers.onMessage(message);
      }
    },
  });
}

export function disconnectAllChatWebSockets() {
  disconnectAllStompConnections();
}

export type NotificationWebSocketHandlers = {
  onNotification: (notification: AppNotification) => void;
  onStateChange: (state: StompConnectionState) => void;
};

export function subscribeToNotifications(token: string, handlers: NotificationWebSocketHandlers) {
  return subscribeToStompDestination(token, '/user/queue/notifications', {
    onStateChange: handlers.onStateChange,
    onFrame: (body) => {
      const notification = parseNotification(body);
      if (notification) handlers.onNotification(notification);
    },
  });
}

export function parseNotification(body: string): AppNotification | null {
  try {
    const value: unknown = JSON.parse(body);
    if (typeof value !== 'object' || value === null) return null;

    const notification = value as Partial<AppNotification>;
    const notificationTypes: NotificationType[] = [
      'FRIEND_REQUEST_RECEIVED',
      'FRIEND_REQUEST_ACCEPTED',
      'NEW_MESSAGE',
    ];
    const referenceTypes: NotificationReferenceType[] = ['FRIEND_REQUEST', 'MESSAGE'];
    if (
      !Number.isSafeInteger(notification.id) || Number(notification.id) <= 0
      || !Number.isSafeInteger(notification.recipientId) || Number(notification.recipientId) <= 0
      || !notificationTypes.includes(notification.type as NotificationType)
      || !referenceTypes.includes(notification.referenceType as NotificationReferenceType)
      || !Number.isSafeInteger(notification.referenceId) || Number(notification.referenceId) <= 0
      || (notification.conversationId !== null
        && (!Number.isSafeInteger(notification.conversationId) || Number(notification.conversationId) <= 0))
      || typeof notification.title !== 'string'
      || typeof notification.message !== 'string'
      || typeof notification.read !== 'boolean'
      || typeof notification.createdAt !== 'string'
      || Number.isNaN(Date.parse(notification.createdAt))
      || (notification.readAt !== null
        && (typeof notification.readAt !== 'string' || Number.isNaN(Date.parse(notification.readAt))))
    ) {
      return null;
    }

    return notification as AppNotification;
  } catch {
    return null;
  }
}

export function parseChatMessage(body: string): ChatMessage | null {
  try {
    const value: unknown = JSON.parse(body);
    if (typeof value !== 'object' || value === null) return null;

    const message = value as Partial<ChatMessage>;
    if (
      !Number.isSafeInteger(message.messageId) || Number(message.messageId) <= 0
      || !Number.isSafeInteger(message.conversationId) || Number(message.conversationId) <= 0
      || !Number.isSafeInteger(message.senderId) || Number(message.senderId) <= 0
      || typeof message.content !== 'string'
      || typeof message.createdAt !== 'string'
      || Number.isNaN(Date.parse(message.createdAt))
    ) {
      return null;
    }

    return message as ChatMessage;
  } catch {
    return null;
  }
}