import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config/api';
import { ChatMessage } from '../types/chat';
import { AppNotification, NotificationReferenceType, NotificationType } from '../types/notification';

export type ChatConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'error';

export type ChatWebSocketHandlers = {
  onMessage: (message: ChatMessage) => void;
  onStateChange: (state: ChatConnectionState) => void;
};

export type NotificationWebSocketHandlers = {
  onNotification: (notification: AppNotification) => void;
  onStateChange: (state: ChatConnectionState) => void;
};

const activeConnections = new Set<() => void>();

export function disconnectAllChatWebSockets() {
  for (const disconnect of [...activeConnections]) {
    disconnect();
  }
}

export function buildChatWebSocketUrl() {
  const url = new URL(API_BASE_URL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/ws`;
  return url.toString();
}

export function subscribeToConversation(
  conversationId: number,
  token: string,
  handlers: ChatWebSocketHandlers,
) {
  let active = true;
  let subscription: StompSubscription | null = null;

  const client = new Client({
    brokerURL: buildChatWebSocketUrl(),
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 3000,
    connectionTimeout: 10000,
    appendMissingNULLonIncoming: Platform.OS !== 'web',
    debug: () => undefined,
    onConnect: () => {
      if (!active) {
        return;
      }
      subscription?.unsubscribe();
      handlers.onStateChange('connected');
      subscription = client.subscribe(`/topic/chat/${conversationId}`, (frame: IMessage) => {
        if (!active) {
          return;
        }
        const message = parseChatMessage(frame.body);
        if (message && message.conversationId === conversationId) {
          handlers.onMessage(message);
        }
      });
    },
    onStompError: () => {
      if (active) {
        handlers.onStateChange('error');
      }
    },
    onWebSocketClose: () => {
      if (active) {
        handlers.onStateChange('reconnecting');
      }
    },
    onWebSocketError: () => {
      if (active) {
        handlers.onStateChange('reconnecting');
      }
    },
  });

  handlers.onStateChange('connecting');
  const disconnect = () => {
    if (!active) {
      return;
    }
    active = false;
    activeConnections.delete(disconnect);
    subscription?.unsubscribe();
    void client.deactivate().catch(() => undefined);
  };
  activeConnections.add(disconnect);
  client.activate();

  return disconnect;
}

export function subscribeToNotifications(token: string, handlers: NotificationWebSocketHandlers) {
  let active = true;
  let subscription: StompSubscription | null = null;

  const client = new Client({
    brokerURL: buildChatWebSocketUrl(),
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 3000,
    connectionTimeout: 10000,
    appendMissingNULLonIncoming: Platform.OS !== 'web',
    debug: () => undefined,
    onConnect: () => {
      if (!active) {
        return;
      }
      subscription?.unsubscribe();
      handlers.onStateChange('connected');
      subscription = client.subscribe('/user/queue/notifications', (frame: IMessage) => {
        if (!active) {
          return;
        }
        const notification = parseNotification(frame.body);
        if (notification) {
          handlers.onNotification(notification);
        }
      });
    },
    onStompError: () => {
      if (active) {
        handlers.onStateChange('error');
      }
    },
    onWebSocketClose: () => {
      if (active) {
        handlers.onStateChange('reconnecting');
      }
    },
    onWebSocketError: () => {
      if (active) {
        handlers.onStateChange('reconnecting');
      }
    },
  });

  handlers.onStateChange('connecting');
  const disconnect = () => {
    if (!active) {
      return;
    }
    active = false;
    activeConnections.delete(disconnect);
    subscription?.unsubscribe();
    void client.deactivate().catch(() => undefined);
  };
  activeConnections.add(disconnect);
  client.activate();

  return disconnect;
}

function parseChatMessage(body: string): ChatMessage | null {
  try {
    const value: unknown = JSON.parse(body);
    if (typeof value !== 'object' || value === null) {
      return null;
    }

    const message = value as Partial<ChatMessage>;
    if (
      typeof message.messageId !== 'number'
      || typeof message.conversationId !== 'number'
      || typeof message.senderId !== 'number'
      || typeof message.content !== 'string'
      || typeof message.createdAt !== 'string'
    ) {
      return null;
    }

    return message as ChatMessage;
  } catch {
    return null;
  }
}

function parseNotification(body: string): AppNotification | null {
  try {
    const value: unknown = JSON.parse(body);
    if (typeof value !== 'object' || value === null) {
      return null;
    }

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