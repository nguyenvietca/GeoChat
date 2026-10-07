import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { apiBaseUrl } from '../api/client';
import { ChatMessage } from '../types';

export type ChatConnectionState = 'connecting' | 'connected' | 'reconnecting';

export type ChatWebSocketHandlers = {
  onMessage: (message: ChatMessage) => void;
  onStateChange: (state: ChatConnectionState) => void;
};

const activeConnections = new Set<() => void>();

export function buildChatWebSocketUrl() {
  const url = new URL(apiBaseUrl);
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
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: () => undefined,
    onConnect: () => {
      if (!active) return;
      subscription?.unsubscribe();
      handlers.onStateChange('connected');
      subscription = client.subscribe(`/topic/chat/${conversationId}`, (frame: IMessage) => {
        if (!active) return;
        const message = parseChatMessage(frame.body);
        if (message?.conversationId === conversationId) {
          handlers.onMessage(message);
        }
      });
    },
    onStompError: () => {
      if (active) handlers.onStateChange('reconnecting');
    },
    onWebSocketClose: () => {
      if (active) handlers.onStateChange('reconnecting');
    },
    onWebSocketError: () => {
      if (active) handlers.onStateChange('reconnecting');
    },
  });

  const disconnect = () => {
    if (!active) return;
    active = false;
    subscription?.unsubscribe();
    activeConnections.delete(disconnect);
    void client.deactivate().catch(() => undefined);
  };

  activeConnections.add(disconnect);
  handlers.onStateChange('connecting');
  client.activate();

  return disconnect;
}

export function disconnectAllChatWebSockets() {
  for (const disconnect of [...activeConnections]) {
    disconnect();
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