import { ConversationReadState, AppNotification, ChatMessage, ChatTypingEvent, GroupManagementEvent, GroupManagementEventType, NotificationReferenceType, NotificationType, UserPresence } from '../types';
import {
  buildWebSocketUrl,
  disconnectAllStompConnections,
  StompConnectionState,
  publishToStompDestination,
  subscribeToStompDestination,
} from './stompConnection';

export type ChatConnectionState = StompConnectionState;

export type ChatWebSocketHandlers = {
  onMessage: (message: ChatMessage) => void;
  onTyping?: (event: ChatTypingEvent) => void;
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
  const unsubscribeMessages = subscribeToStompDestination(token, `/topic/chat/${conversationId}`, {
    onStateChange: handlers.onStateChange,
    onFrame: (body) => {
      const message = parseChatMessage(body);
      if (message?.conversationId === conversationId) handlers.onMessage(message);
    },
  });
  const unsubscribeTyping = subscribeToStompDestination(token, `/topic/chat/${conversationId}/typing`, {
    onStateChange: () => {},
    onFrame: (body) => {
      const typingEvent = parseChatTypingEvent(body);
      if (typingEvent?.conversationId === conversationId) handlers.onTyping?.(typingEvent);
    },
  });
  return () => { unsubscribeTyping(); unsubscribeMessages(); };
}

let typingActivityId = 0;

export function publishTypingState(conversationId: number, token: string, state: 'START' | 'STOP') {
  return publishToStompDestination(token, `/app/chat/${conversationId}/typing`, JSON.stringify({ state, activityId: ++typingActivityId }));
}

export function parseChatTypingEvent(body: string): ChatTypingEvent | null {
  try {
    const value: unknown = JSON.parse(body);
    if (!isRecord(value)
      || value.type !== 'TYPING'
      || !Number.isSafeInteger(value.conversationId) || Number(value.conversationId) <= 0
      || !Number.isSafeInteger(value.senderId) || Number(value.senderId) <= 0
      || typeof value.senderDisplayName !== 'string' || !value.senderDisplayName.trim()
      || (value.state !== 'START' && value.state !== 'STOP')
      || (value.eventId !== undefined && (!Number.isSafeInteger(value.eventId) || Number(value.eventId) <= 0))) return null;
    return {
      conversationId: Number(value.conversationId),
      senderId: Number(value.senderId),
      senderDisplayName: value.senderDisplayName,
      type: 'TYPING',
      state: value.state,
      ...(value.eventId === undefined ? {} : { eventId: Number(value.eventId) }),
    };
  } catch {
    return null;
  }
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

export type GroupManagementHandlers = {
  onEvent: (event: GroupManagementEvent) => void;
  onStateChange: (state: StompConnectionState) => void;
};

export function subscribeToGroupEvents(token: string, handlers: GroupManagementHandlers) {
  return subscribeToStompDestination(token, '/user/queue/group-events', {
    onStateChange: handlers.onStateChange,
    onFrame: (body) => {
      const event = parseGroupManagementEvent(body);
      if (event) handlers.onEvent(event);
    },
  });
}

export function parseGroupManagementEvent(body: string): GroupManagementEvent | null {
  try {
    const value: unknown = JSON.parse(body);
    if (!isRecord(value) || !isRecord(value.group)) return null;

    const group = value.group;
    const groupInfo = group as Partial<GroupManagementEvent['group']>;
    const owner = groupInfo.owner;
    const eventTypes: GroupManagementEventType[] = ['GROUP_RENAMED', 'MEMBER_ADDED', 'MEMBER_REMOVED', 'MEMBER_LEFT', 'GROUP_DELETED'];
    if (
      !eventTypes.includes(value.type as GroupManagementEventType)
      || !Number.isSafeInteger(groupInfo.groupId) || Number(groupInfo.groupId) <= 0
      || typeof groupInfo.name !== 'string'
      || !isRecord(owner)
      || !Number.isSafeInteger(owner.userId) || Number(owner.userId) <= 0
      || typeof owner.username !== 'string' || typeof owner.displayName !== 'string'
      || !Number.isSafeInteger(groupInfo.memberCount) || Number(groupInfo.memberCount) < 0
      || typeof groupInfo.createdAt !== 'string' || Number.isNaN(Date.parse(groupInfo.createdAt))
      || typeof groupInfo.updatedAt !== 'string' || Number.isNaN(Date.parse(groupInfo.updatedAt))
    ) {
      return null;
    }

    let member: GroupManagementEvent['member'] = null;
    if (value.member !== null) {
      if (!isRecord(value.member) || !isRecord(value.member.user)) return null;
      const user = value.member.user;
      if (
        !Number.isSafeInteger(user.userId) || Number(user.userId) <= 0
        || typeof user.username !== 'string' || typeof user.displayName !== 'string'
        || typeof value.member.role !== 'string'
        || typeof value.member.joinedAt !== 'string' || Number.isNaN(Date.parse(value.member.joinedAt))
      ) {
        return null;
      }
      member = value.member as GroupManagementEvent['member'];
    }

    return { type: value.type as GroupManagementEventType, group: group as GroupManagementEvent['group'], member };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export type PresenceHandlers = {
  onPresence: (presence: UserPresence) => void;
  onStateChange: (state: StompConnectionState) => void;
};

export function subscribeToPresence(userId: number, token: string, handlers: PresenceHandlers) {
  return subscribeToStompDestination(token, `/topic/presence/${userId}`, {
    onStateChange: handlers.onStateChange,
    onFrame: (body) => {
      const presence = parseUserPresence(body);
      if (presence?.userId === userId) handlers.onPresence(presence);
    },
  });
}

export function parseUserPresence(body: string): UserPresence | null {
  try {
    const value: unknown = JSON.parse(body);
    if (!isRecord(value)
      || !Number.isSafeInteger(value.userId) || Number(value.userId) <= 0
      || typeof value.online !== 'boolean') return null;
    return { userId: Number(value.userId), online: value.online };
  } catch {
    return null;
  }
}
// One account activity subscription covers selected and unselected conversations.
export function subscribeToConversationActivity(token: string, handlers: {
  onActivity: (message: ChatMessage, senderDisplayName: string, state?: ConversationReadState) => void;
  onReadState?: (state: ConversationReadState) => void;
  onStateChange: (state: ChatConnectionState) => void;
}) {
  const unsubscribeActivity = subscribeToStompDestination(token, '/user/queue/conversation-activity', {
    onStateChange: handlers.onStateChange,
    onFrame: (body) => {
      try {
        const value: unknown = JSON.parse(body);
        if (!isRecord(value) || typeof value.senderDisplayName !== 'string') return;
        const message = parseChatMessage(JSON.stringify(value.message));
        if (!message) return;
        const state = parseConversationReadState(JSON.stringify({ ...value, conversationId: message.conversationId }));
        if (state) handlers.onActivity(message, value.senderDisplayName, state);
        else handlers.onActivity(message, value.senderDisplayName);
      } catch { /* Ignore malformed frames. */ }
    },
  });
  const unsubscribeRead = handlers.onReadState ? subscribeToStompDestination(token, '/user/queue/conversation-read', {
    onStateChange: () => {},
    onFrame: (body) => {
      const state = parseConversationReadState(body);
      if (state) handlers.onReadState?.(state);
    },
  }) : undefined;
  return () => { unsubscribeActivity(); unsubscribeRead?.(); };
}

export function parseConversationReadState(body: string): ConversationReadState | null {
  try {
    const value: unknown = JSON.parse(body);
    if (!isRecord(value) || !Number.isSafeInteger(value.conversationId) || Number(value.conversationId) <= 0
      || !Number.isSafeInteger(value.unreadCount) || Number(value.unreadCount) < 0
      || !Number.isSafeInteger(value.readStateVersion) || Number(value.readStateVersion) < 0) return null;
    return { conversationId: Number(value.conversationId), unreadCount: Number(value.unreadCount), readStateVersion: Number(value.readStateVersion),
      ...(typeof value.readStateSince === 'string' && !Number.isNaN(Date.parse(value.readStateSince)) ? { readStateSince: value.readStateSince } : {}) };
  } catch { return null; }
}
