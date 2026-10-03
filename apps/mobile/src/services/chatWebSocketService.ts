import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config/api';
import { ChatMessage } from '../types/chat';

export type ChatConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'error';

export type ChatWebSocketHandlers = {
  onMessage: (message: ChatMessage) => void;
  onStateChange: (state: ChatConnectionState) => void;
};

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
  client.activate();

  return () => {
    active = false;
    subscription?.unsubscribe();
    void client.deactivate();
  };
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