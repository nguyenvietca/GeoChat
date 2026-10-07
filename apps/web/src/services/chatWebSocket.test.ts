import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildChatWebSocketUrl,
  disconnectAllChatWebSockets,
  parseChatMessage,
  subscribeToConversation,
} from './chatWebSocket';
import { ChatMessage } from '../types';

const stompHarness = vi.hoisted(() => ({
  configuration: null as unknown,
  frameCallback: null as unknown,
  subscription: { unsubscribe: vi.fn() },
  client: {
    activate: vi.fn(),
    deactivate: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(),
  },
}));

vi.mock('@stomp/stompjs', () => ({
  Client: function MockClient(configuration: unknown) {
    stompHarness.configuration = configuration;
    stompHarness.client.subscribe.mockImplementation((_destination: unknown, callback: unknown) => {
      stompHarness.frameCallback = callback;
      return stompHarness.subscription;
    });
    return stompHarness.client;
  },
}));

type StompConfiguration = {
  connectHeaders: Record<string, string>;
  onConnect: () => void;
  onWebSocketClose: () => void;
};

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    messageId: 2,
    conversationId: 42,
    senderId: 9,
    content: 'A safe text message',
    createdAt: '2026-10-06T12:00:00Z',
    ...overrides,
  };
}

describe('web chat WebSocket service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stompHarness.configuration = null;
    stompHarness.frameCallback = null;
    stompHarness.client.deactivate.mockResolvedValue(undefined);
  });

  afterEach(() => disconnectAllChatWebSockets());

  it('builds the existing backend WebSocket URL and authenticates STOMP CONNECT with JWT', () => {
    const onMessage = vi.fn();
    const onStateChange = vi.fn();
    subscribeToConversation(42, 'secret-jwt', { onMessage, onStateChange });

    expect(buildChatWebSocketUrl()).toBe('ws://localhost:8080/ws');
    expect((stompHarness.configuration as StompConfiguration).connectHeaders)
      .toEqual({ Authorization: 'Bearer secret-jwt' });
    expect(stompHarness.client.activate).toHaveBeenCalledOnce();
    expect(onStateChange).toHaveBeenCalledWith('connecting');
  });

  it('subscribes to only the active conversation and ignores invalid/wrong-conversation frames', () => {
    const onMessage = vi.fn();
    const onStateChange = vi.fn();
    subscribeToConversation(42, 'jwt', { onMessage, onStateChange });
    const configuration = stompHarness.configuration as StompConfiguration;
    configuration.onConnect();

    expect(stompHarness.client.subscribe).toHaveBeenCalledWith('/topic/chat/42', expect.any(Function));
    const receiveFrame = stompHarness.frameCallback as (frame: { body: string }) => void;
    receiveFrame({ body: JSON.stringify(message({ conversationId: 77 })) });
    receiveFrame({ body: '{not json}' });
    receiveFrame({ body: JSON.stringify(message()) });
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(message());
  });

  it('validates stable IDs and reconnects by restoring a single topic subscription', () => {
    expect(parseChatMessage(JSON.stringify(message({ messageId: 0 })))).toBeNull();
    expect(parseChatMessage(JSON.stringify(message({ createdAt: 'invalid' })))).toBeNull();
    expect(parseChatMessage(JSON.stringify(message()))).toEqual(message());

    const onStateChange = vi.fn();
    const cleanup = subscribeToConversation(42, 'jwt', { onMessage: vi.fn(), onStateChange });
    const configuration = stompHarness.configuration as StompConfiguration;
    configuration.onConnect();
    configuration.onWebSocketClose();
    configuration.onConnect();

    expect(onStateChange).toHaveBeenCalledWith('connected');
    expect(onStateChange).toHaveBeenCalledWith('reconnecting');
    expect(stompHarness.client.subscribe).toHaveBeenCalledTimes(2);
    expect(stompHarness.subscription.unsubscribe).toHaveBeenCalledOnce();

    cleanup();
    expect(stompHarness.client.deactivate).toHaveBeenCalledOnce();
    expect(stompHarness.subscription.unsubscribe).toHaveBeenCalledTimes(2);
  });
});