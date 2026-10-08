/**
 * Tests for chatWebSocketService.ts
 *
 * Coverage (PROMPT 015, section 29 — WebSocket):
 *  - connection (activate called, state → 'connected')
 *  - subscription to /topic/chat/{conversationId}
 *  - message handling (valid payload delivered to handler)
 *  - duplicate message prevention via conversationId check
 *  - cleanup / unsubscribe on returned teardown
 *  - error state (onStompError)
 *  - disconnect / reconnecting state
 *  - malformed message body silently ignored
 */

import { Client } from '@stomp/stompjs';
import {
  subscribeToConversation,
  subscribeToNotifications,
  buildChatWebSocketUrl,
  disconnectAllChatWebSockets,
} from '../services/chatWebSocketService';
import type { ChatConnectionState } from '../services/chatWebSocketService';

// Access the mocked Client
const MockClient = Client as jest.MockedClass<typeof Client>;

// We need to capture the Client constructor args so we can call handlers
let lastClientInstance: InstanceType<typeof MockClient> | null = null;

jest.mock('@stomp/stompjs', () => {
  const actual = jest.requireActual('../__mocks__/@stomp/stompjs');
  const OrigClient = actual.Client;
  const Spy = jest.fn().mockImplementation((config: ConstructorParameters<typeof OrigClient>[0]) => {
    const instance = new OrigClient(config);
    lastClientInstance = instance as unknown as InstanceType<typeof MockClient>;
    return instance;
  });
  return { ...actual, Client: Spy };
});

// Silence Platform import error in Node environment
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }), { virtual: true });

// Silence config/api in Node environment
jest.mock('../config/api', () => ({ API_BASE_URL: 'http://localhost:8080' }), { virtual: true });

function makeMessage(overrides: Partial<{
  messageId: number;
  conversationId: number;
  senderId: number;
  content: string;
  createdAt: string;
}> = {}) {
  return JSON.stringify({
    messageId: 1,
    conversationId: 10,
    senderId: 5,
    content: 'Hello',
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  });
}

function makeNotification(overrides: Partial<{
  id: number;
  recipientId: number;
  type: string;
  title: string;
  message: string;
  referenceType: string;
  referenceId: number;
  conversationId: number | null;
  read: boolean;
  createdAt: string;
  readAt: string | null;
}> = {}) {
  return JSON.stringify({
    id: 4,
    recipientId: 9,
    type: 'NEW_MESSAGE',
    title: 'New message',
    message: 'A message arrived.',
    referenceType: 'MESSAGE',
    referenceId: 20,
    conversationId: 30,
    read: false,
    createdAt: '2026-10-06T12:00:00Z',
    readAt: null,
    ...overrides,
  });
}

describe('chatWebSocketService', () => {
  beforeEach(() => {
    lastClientInstance = null;
    jest.clearAllMocks();
  });

  afterEach(() => disconnectAllChatWebSockets());

  // -------------------------------------------------------------------------
  // buildChatWebSocketUrl
  // -------------------------------------------------------------------------
  describe('buildChatWebSocketUrl', () => {
    it('converts http to ws and appends /ws path', () => {
      const url = buildChatWebSocketUrl();
      expect(url).toMatch(/^ws:/);
      expect(url).toMatch(/\/ws$/);
    });
  });

  // -------------------------------------------------------------------------
  // Connection
  // -------------------------------------------------------------------------
  describe('connection', () => {
    it('changes state to connecting then connected', () => {
      const states: ChatConnectionState[] = [];
      subscribeToConversation(10, 'tok', {
        onMessage: () => undefined,
        onStateChange: (s) => states.push(s),
      });

      expect(states).toContain('connecting');
      expect(states).toContain('connected');
    });

    it('passes Authorization header on CONNECT', () => {
      subscribeToConversation(10, 'my-jwt', {
        onMessage: () => undefined,
        onStateChange: () => undefined,
      });
      expect(lastClientInstance?.connectHeaders?.Authorization).toBe('Bearer my-jwt');
    });
  });

  // -------------------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------------------
  describe('subscription', () => {
    it('uses the conversation topic for group IDs and restores one subscription after reconnect', () => {
      const received: unknown[] = [];
      subscribeToConversation(42, 'tok', {
        onMessage: (message) => received.push(message),
        onStateChange: () => undefined,
      });
      const client = lastClientInstance as unknown as {
        _subscriptions: Map<string, unknown>;
        _simulateDisconnect: () => void;
        _simulateMessage: (body: string) => void;
        onConnect: (() => void) | null;
      };

      expect([...client._subscriptions.keys()]).toEqual(['/topic/chat/42']);
      client._simulateDisconnect();
      client.onConnect?.();
      expect([...client._subscriptions.keys()]).toEqual(['/topic/chat/42']);
      client._simulateMessage(makeMessage({ conversationId: 42 }));
      expect(received).toHaveLength(1);
    });

    it('unsubscribes from the group topic when the screen is left', () => {
      const teardown = subscribeToConversation(42, 'tok', {
        onMessage: () => undefined,
        onStateChange: () => undefined,
      });
      const client = lastClientInstance as unknown as { _subscriptions: Map<string, unknown> };

      expect(client._subscriptions.has('/topic/chat/42')).toBe(true);
      teardown();
      expect(client._subscriptions.size).toBe(0);
    });
  });

  describe('notification subscription', () => {
    it('authenticates, parses stable notification IDs, and replaces the subscription after reconnect', () => {
      const received: unknown[] = [];
      const states: ChatConnectionState[] = [];
      subscribeToNotifications('notification-token', {
        onNotification: (notification) => received.push(notification),
        onStateChange: (state) => states.push(state),
      });

      expect(lastClientInstance?.connectHeaders?.Authorization).toBe('Bearer notification-token');
      expect(states).toContain('connected');
      const client = lastClientInstance as unknown as {
        _simulateMessage: (body: string) => void;
        _simulateDisconnect: () => void;
        onConnect: (() => void) | null;
      };
      client._simulateMessage(makeNotification());
      client._simulateMessage('{invalid');
      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({ id: 4, recipientId: 9, conversationId: 30 });

      client._simulateDisconnect();
      client.onConnect?.();
      expect(states).toContain('reconnecting');
      expect(states.filter((state) => state === 'connected')).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Message handling
  // -------------------------------------------------------------------------
  describe('message handling', () => {
    it('delivers a valid message to onMessage handler', () => {
      const received: unknown[] = [];
      subscribeToConversation(10, 'tok', {
        onMessage: (msg) => received.push(msg),
        onStateChange: () => undefined,
      });

      (lastClientInstance as unknown as { _simulateMessage: (b: string) => void })._simulateMessage(
        makeMessage({ conversationId: 10 }),
      );

      expect(received).toHaveLength(1);
      expect((received[0] as { messageId: number }).messageId).toBe(1);
    });

    it('silently ignores messages for a different conversationId', () => {
      const received: unknown[] = [];
      subscribeToConversation(10, 'tok', {
        onMessage: (msg) => received.push(msg),
        onStateChange: () => undefined,
      });

      (lastClientInstance as unknown as { _simulateMessage: (b: string) => void })._simulateMessage(
        makeMessage({ conversationId: 99 }), // different conversation
      );

      expect(received).toHaveLength(0);
    });

    it('silently ignores malformed JSON body', () => {
      const received: unknown[] = [];
      subscribeToConversation(10, 'tok', {
        onMessage: (msg) => received.push(msg),
        onStateChange: () => undefined,
      });

      (lastClientInstance as unknown as { _simulateMessage: (b: string) => void })._simulateMessage(
        'not valid json',
      );

      expect(received).toHaveLength(0);
    });

    it('silently ignores message missing required fields', () => {
      const received: unknown[] = [];
      subscribeToConversation(10, 'tok', {
        onMessage: (msg) => received.push(msg),
        onStateChange: () => undefined,
      });

      (lastClientInstance as unknown as { _simulateMessage: (b: string) => void })._simulateMessage(
        JSON.stringify({ messageId: 1, conversationId: 10 }), // missing senderId, content, createdAt
      );

      expect(received).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Error / reconnect states
  // -------------------------------------------------------------------------
  describe('connection states', () => {
    it('sets state to error on STOMP error', () => {
      const states: ChatConnectionState[] = [];
      subscribeToConversation(10, 'tok', {
        onMessage: () => undefined,
        onStateChange: (s) => states.push(s),
      });

      (lastClientInstance as unknown as { _simulateError: () => void })._simulateError();

      expect(states).toContain('error');
    });

    it('sets state to reconnecting on WebSocket close', () => {
      const states: ChatConnectionState[] = [];
      subscribeToConversation(10, 'tok', {
        onMessage: () => undefined,
        onStateChange: (s) => states.push(s),
      });

      (lastClientInstance as unknown as { _simulateDisconnect: () => void })._simulateDisconnect();

      expect(states).toContain('reconnecting');
    });
  });

  // -------------------------------------------------------------------------
  // Cleanup / unsubscribe
  // -------------------------------------------------------------------------
  describe('cleanup', () => {
    it('returns a teardown function', () => {
      const teardown = subscribeToConversation(10, 'tok', {
        onMessage: () => undefined,
        onStateChange: () => undefined,
      });

      expect(typeof teardown).toBe('function');
    });

    it('stops delivering messages after teardown', () => {
      const received: unknown[] = [];

      const teardown = subscribeToConversation(10, 'tok', {
        onMessage: (msg) => received.push(msg),
        onStateChange: () => undefined,
      });

      teardown();

      (lastClientInstance as unknown as { _simulateMessage: (b: string) => void })._simulateMessage(
        makeMessage({ conversationId: 10 }),
      );

      expect(received).toHaveLength(0);
    });

    it('stops updating state after teardown', () => {
      const states: ChatConnectionState[] = [];
      const teardown = subscribeToConversation(10, 'tok', {
        onMessage: () => undefined,
        onStateChange: (s) => states.push(s),
      });

      const statesAfterSetup = [...states];
      teardown();

      (lastClientInstance as unknown as { _simulateError: () => void })._simulateError();
      (lastClientInstance as unknown as { _simulateDisconnect: () => void })._simulateDisconnect();

      // No new states should have been pushed after teardown
      expect(states).toEqual(statesAfterSetup);
    });

    it('disconnects active sockets when the authenticated session ends', () => {
      const received: unknown[] = [];
      subscribeToConversation(10, 'tok', {
        onMessage: (message) => received.push(message),
        onStateChange: () => undefined,
      });
      const client = lastClientInstance as unknown as { _simulateMessage: (body: string) => void };

      disconnectAllChatWebSockets();
      client._simulateMessage(makeMessage({ conversationId: 10 }));

      expect(received).toHaveLength(0);
    });
  });
});
