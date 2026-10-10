import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildChatWebSocketUrl,
  disconnectAllChatWebSockets,
  parseChatMessage,
  parseChatTypingEvent,
  parseConversationReadState,
  parseGroupManagementEvent,
  parseUserPresence,
  parseNotification,
  publishTypingState,
  subscribeToNotifications,
  subscribeToGroupEvents,
  subscribeToPresence,
  subscribeToConversation,
  subscribeToConversationActivity,
} from './chatWebSocket';
import { AppNotification, ChatMessage, GroupManagementEvent } from '../types';

const stompHarness = vi.hoisted(() => ({
  configuration: null as unknown,
  frameCallback: null as unknown,
  frameCallbacks: new Map<string, unknown>(),
  subscription: { unsubscribe: vi.fn() },
  client: {
    activate: vi.fn(),
    deactivate: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(),
    publish: vi.fn(),
  },
}));

vi.mock('@stomp/stompjs', () => ({
  Client: function MockClient(configuration: unknown) {
    stompHarness.configuration = configuration;
    stompHarness.client.subscribe.mockImplementation((destination: unknown, callback: unknown) => {
      stompHarness.frameCallback = callback;
      stompHarness.frameCallbacks.set(String(destination), callback);
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

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 5,
    recipientId: 9,
    type: 'NEW_MESSAGE',
    title: 'New message',
    message: 'A message arrived.',
    referenceType: 'MESSAGE',
    referenceId: 14,
    conversationId: 42,
    read: false,
    createdAt: '2026-10-06T12:00:00Z',
    readAt: null,
    ...overrides,
  };
}

function groupManagementEvent(overrides: Partial<GroupManagementEvent> = {}): GroupManagementEvent {
  return {
    type: 'GROUP_RENAMED',
    group: {
      groupId: 42,
      name: 'Weekend crew',
      owner: { userId: 9, username: 'mira', displayName: 'Mira Vale' },
      memberCount: 2,
      createdAt: '2026-10-06T12:00:00Z',
      updatedAt: '2026-10-06T12:01:00Z',
    },
    member: null,
    ...overrides,
  };
}

describe('web chat WebSocket service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stompHarness.configuration = null;
    stompHarness.frameCallback = null;
    stompHarness.frameCallbacks.clear();
    stompHarness.client.deactivate.mockResolvedValue(undefined);
  });

  afterEach(() => disconnectAllChatWebSockets());

  it('uses one authenticated activity queue, validates frames and cleans up', () => {
    const onActivity = vi.fn();
    const cleanup = subscribeToConversationActivity('jwt', { onActivity, onStateChange: vi.fn() });
    (stompHarness.configuration as StompConfiguration).onConnect();
    expect(stompHarness.client.subscribe).toHaveBeenCalledWith('/user/queue/conversation-activity', expect.any(Function));
    const receive = stompHarness.frameCallback as (frame: { body: string }) => void;
    receive({ body: '{invalid' });
    receive({ body: JSON.stringify({ message: message(), senderDisplayName: 5 }) });
    receive({ body: JSON.stringify({ message: message({ conversationId: -1 }), senderDisplayName: 'Mira' }) });
    receive({ body: JSON.stringify({ message: message(), senderDisplayName: 'Mira' }) });
    expect(onActivity).toHaveBeenCalledTimes(1);
    expect(onActivity).toHaveBeenCalledWith(message(), 'Mira');
    cleanup();
    expect(stompHarness.subscription.unsubscribe).toHaveBeenCalledOnce();
    receive({ body: JSON.stringify({ message: message(), senderDisplayName: 'Mira' }) });
    expect(onActivity).toHaveBeenCalledTimes(1);
  });

  it('receives authoritative activity/read snapshots on the shared account connection and cleans up both queues', () => {
    const onActivity = vi.fn(), onReadState = vi.fn();
    const cleanup = subscribeToConversationActivity('jwt', { onActivity, onReadState, onStateChange: vi.fn() });
    (stompHarness.configuration as StompConfiguration).onConnect();
    expect(stompHarness.client.activate).toHaveBeenCalledOnce();
    const activityCallback = stompHarness.client.subscribe.mock.calls.find(([destination]) => destination === '/user/queue/conversation-activity')![1] as (frame: { body: string }) => void;
    const readCallback = stompHarness.client.subscribe.mock.calls.find(([destination]) => destination === '/user/queue/conversation-read')![1] as (frame: { body: string }) => void;
    const state = { conversationId: 42, unreadCount: 3, readStateVersion: 5 };
    activityCallback({ body: JSON.stringify({ message: message(), senderDisplayName: 'Mira', unreadCount: 3, readStateVersion: 5 }) });
    expect(onActivity).toHaveBeenCalledWith(message(), 'Mira', state);
    readCallback({ body: JSON.stringify(state) });
    expect(onReadState).toHaveBeenCalledWith(state);
    readCallback({ body: JSON.stringify({ ...state, unreadCount: -1 }) });
    expect(onReadState).toHaveBeenCalledOnce();
    expect(parseConversationReadState('{invalid')).toBeNull();
    cleanup();
    expect(stompHarness.subscription.unsubscribe).toHaveBeenCalledTimes(2);
    readCallback({ body: JSON.stringify(state) });
    expect(onReadState).toHaveBeenCalledOnce();
  });

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
    expect(stompHarness.client.subscribe).toHaveBeenCalledWith('/topic/chat/42/typing', expect.any(Function));
    const receiveFrame = stompHarness.frameCallbacks.get('/topic/chat/42') as (frame: { body: string }) => void;
    receiveFrame({ body: JSON.stringify(message({ conversationId: 77 })) });
    receiveFrame({ body: '{not json}' });
    receiveFrame({ body: JSON.stringify(message()) });
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(message());
  });

  it('routes validated typing events on a dedicated conversation subscription', () => {
    const onMessage = vi.fn();
    const onTyping = vi.fn();
    const cleanup = subscribeToConversation(42, 'jwt', { onMessage, onTyping, onStateChange: vi.fn() });
    (stompHarness.configuration as StompConfiguration).onConnect();
    const receiveFrame = stompHarness.frameCallbacks.get('/topic/chat/42/typing') as (frame: { body: string }) => void;
    const event = { type: 'TYPING', conversationId: 42, senderId: 9, senderDisplayName: 'Mira', state: 'START' };
    receiveFrame({ body: JSON.stringify({ ...event, conversationId: 77 }) });
    receiveFrame({ body: JSON.stringify({ ...event, state: 'MAYBE' }) });
    receiveFrame({ body: JSON.stringify(event) });
    expect(onTyping).toHaveBeenCalledOnce();
    expect(onTyping).toHaveBeenCalledWith(event);
    expect(onMessage).not.toHaveBeenCalled();
    expect(parseChatTypingEvent(JSON.stringify(event))).toEqual(event);
    expect(parseChatTypingEvent(JSON.stringify({ ...event, senderId: 0 }))).toBeNull();
    cleanup();
  });

  it('validates stable IDs and restores each conversation subscription once on reconnect', () => {
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
    expect(stompHarness.client.subscribe).toHaveBeenCalledTimes(4);
    expect(stompHarness.subscription.unsubscribe).toHaveBeenCalledTimes(2);

    cleanup();
    expect(stompHarness.client.deactivate).toHaveBeenCalledOnce();
    expect(stompHarness.subscription.unsubscribe).toHaveBeenCalledTimes(4);
  });

  it('shares one authenticated STOMP connection between chat and notifications', () => {
    const chatCleanup = subscribeToConversation(42, 'same-token', {
      onMessage: vi.fn(),
      onStateChange: vi.fn(),
    });
    const notificationCleanup = subscribeToNotifications('same-token', {
      onNotification: vi.fn(),
      onStateChange: vi.fn(),
    });

    expect(stompHarness.client.activate).toHaveBeenCalledOnce();
    (stompHarness.configuration as StompConfiguration).onConnect();
    expect(stompHarness.client.subscribe).toHaveBeenCalledWith('/topic/chat/42', expect.any(Function));
    expect(stompHarness.client.subscribe).toHaveBeenCalledWith('/topic/chat/42/typing', expect.any(Function));
    expect(stompHarness.client.subscribe).toHaveBeenCalledWith('/user/queue/notifications', expect.any(Function));

    chatCleanup();
    expect(stompHarness.client.deactivate).not.toHaveBeenCalled();
    notificationCleanup();
    expect(stompHarness.client.deactivate).toHaveBeenCalledOnce();
  });

  it('publishes typing only while the shared authenticated connection is connected', () => {
    subscribeToConversation(42, 'jwt', { onMessage: vi.fn(), onStateChange: vi.fn() });
    expect(publishTypingState(42, 'jwt', 'START')).toBe(false);
    (stompHarness.configuration as StompConfiguration).onConnect();
    expect(publishTypingState(42, 'jwt', 'START')).toBe(true);
    expect(stompHarness.client.publish).toHaveBeenCalledWith({
      destination: '/app/chat/42/typing', body: expect.any(String),
    });
    expect(JSON.parse(stompHarness.client.publish.mock.calls[0][0].body)).toEqual({ state: 'START', activityId: expect.any(Number) });
  });

  it('does not publish during reconnect or throw if the socket closes during publishing', () => {
    subscribeToConversation(42, 'jwt', { onMessage: vi.fn(), onStateChange: vi.fn() });
    const configuration = stompHarness.configuration as StompConfiguration;
    configuration.onConnect();
    stompHarness.client.publish.mockImplementationOnce(() => { throw new Error('Socket closed'); });
    expect(publishTypingState(42, 'jwt', 'START')).toBe(false);
    configuration.onWebSocketClose();
    expect(publishTypingState(42, 'jwt', 'STOP')).toBe(false);
    expect(stompHarness.client.publish).toHaveBeenCalledOnce();
  });

  it('ignores callbacks belonging to an old subscription generation after reconnect', () => {
    const onTyping = vi.fn();
    subscribeToConversation(42, 'jwt', { onMessage: vi.fn(), onTyping, onStateChange: vi.fn() });
    const config = stompHarness.configuration as StompConfiguration;
    config.onConnect();
    const oldFrame = stompHarness.frameCallbacks.get('/topic/chat/42/typing') as (frame: { body: string }) => void;
    config.onWebSocketClose(); config.onConnect();
    const freshFrame = stompHarness.frameCallbacks.get('/topic/chat/42/typing') as (frame: { body: string }) => void;
    const event = { type: 'TYPING', conversationId: 42, senderId: 9, senderDisplayName: 'Mira', state: 'START', eventId: 1 };
    oldFrame({ body: JSON.stringify(event) });
    expect(onTyping).not.toHaveBeenCalled();
    freshFrame({ body: JSON.stringify(event) });
    expect(onTyping).toHaveBeenCalledWith(event);
    expect(parseChatTypingEvent(JSON.stringify({ ...event, eventId: -1 }))).toBeNull();
  });

  it('validates notification payloads and preserves the server notification ID', () => {
    expect(parseNotification(JSON.stringify(notification()))).toEqual(notification());
    expect(parseNotification(JSON.stringify(notification({ id: 0 })))).toBeNull();
    expect(parseNotification(JSON.stringify(notification({ conversationId: -1 })))).toBeNull();
    expect(parseNotification('{not json')).toBeNull();
  });

  it('validates group management events and subscribes to the user-scoped destination', () => {
    const event = groupManagementEvent();
    expect(parseGroupManagementEvent(JSON.stringify(event))).toEqual(event);
    expect(parseGroupManagementEvent(JSON.stringify(groupManagementEvent({ type: 'UNKNOWN' as GroupManagementEvent['type'] })))).toBeNull();

    const onEvent = vi.fn();
    const cleanup = subscribeToGroupEvents('jwt', { onEvent, onStateChange: vi.fn() });
    (stompHarness.configuration as StompConfiguration).onConnect();
    expect(stompHarness.client.subscribe).toHaveBeenCalledWith('/user/queue/group-events', expect.any(Function));
    (stompHarness.frameCallback as (frame: { body: string }) => void)({ body: JSON.stringify(event) });
    expect(onEvent).toHaveBeenCalledWith(event);
    cleanup();
  });

  it('subscribes to authorized presence updates and ignores malformed or unrelated users', () => {
    const onPresence = vi.fn();
    const cleanup = subscribeToPresence(22, 'jwt', { onPresence, onStateChange: vi.fn() });
    (stompHarness.configuration as StompConfiguration).onConnect();
    expect(stompHarness.client.subscribe).toHaveBeenCalledWith('/topic/presence/22', expect.any(Function));
    expect(parseUserPresence('{bad json')).toBeNull();
    expect(parseUserPresence(JSON.stringify({ userId: 22, online: 'yes' }))).toBeNull();

    const receiveFrame = stompHarness.frameCallback as (frame: { body: string }) => void;
    receiveFrame({ body: JSON.stringify({ userId: 23, online: true }) });
    receiveFrame({ body: JSON.stringify({ userId: 22, online: false }) });
    expect(onPresence).toHaveBeenCalledTimes(1);
    expect(onPresence).toHaveBeenCalledWith({ userId: 22, online: false });
    cleanup();
  });
});