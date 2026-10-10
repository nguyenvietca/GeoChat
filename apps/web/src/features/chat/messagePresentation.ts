import { ChatMessage, Conversation, ConversationReadState } from '../../types';

export function activityTime(item: Conversation) {
  const latest = Date.parse(item.lastMessageAt ?? '');
  const fallback = Date.parse(item.updatedAt);
  return Number.isFinite(latest) ? latest : Number.isFinite(fallback) ? fallback : 0;
}

export function formatMessageTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatConversationTime(value: string | null | undefined, now = new Date()) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (date.toDateString() === now.toDateString()) return formatMessageTime(value);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString() ? 'Yesterday'
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}

export function updateConversation(item: Conversation, message: ChatMessage, sender?: string): Conversation {
  if (item.conversationId !== message.conversationId) return item;
  if (item.lastMessageId === message.messageId) return sender && sender !== item.lastMessageSender
    ? { ...item, lastMessageSender: sender } : item;
  if (item.lastMessageAt && compareMessageOrder(message, { createdAt: item.lastMessageAt, messageId: item.lastMessageId ?? 0 }) < 0) return item;
  return { ...item, lastMessage: message.content, lastMessageId: message.messageId,
    lastMessageAt: message.createdAt, lastMessageSender: sender ?? null };
}

export function applyUnreadState(item: Conversation, state: ConversationReadState): Conversation {
  if (item.conversationId !== state.conversationId || compareReadState(state, item) < 0) return item;
  if (item.unreadCount === state.unreadCount && item.readStateVersion === state.readStateVersion && item.readStateSince === state.readStateSince) return item;
  return { ...item, unreadCount: state.unreadCount, readStateVersion: state.readStateVersion, readStateSince: state.readStateSince };
}

export function mergeConversationSnapshot(snapshot: Conversation, live?: Conversation): Conversation {
  if (!live) return snapshot;
  let merged = snapshot;
  if (live.lastMessageAt && (compareTimestamps(live.lastMessageAt, snapshot.lastMessageAt ?? snapshot.updatedAt) > 0
    || (compareTimestamps(live.lastMessageAt, snapshot.lastMessageAt ?? snapshot.updatedAt) === 0 && (live.lastMessageId ?? 0) > (snapshot.lastMessageId ?? 0)))) {
    merged = { ...merged, lastMessage: live.lastMessage, lastMessageAt: live.lastMessageAt,
      lastMessageId: live.lastMessageId, lastMessageSender: live.lastMessageSender };
  }
  return live.readStateVersion !== undefined && live.unreadCount !== undefined
    ? applyUnreadState(merged, { conversationId: live.conversationId, unreadCount: live.unreadCount, readStateVersion: live.readStateVersion, readStateSince: live.readStateSince }) : merged;
}

// Membership creation identifies a new read-state lifetime after leaving/rejoining a group.
export function compareReadState(first: { readStateVersion?: number; readStateSince?: string }, second: { readStateVersion?: number; readStateSince?: string }) {
  if (first.readStateSince && second.readStateSince && first.readStateSince !== second.readStateSince) {
    const delta = compareTimestamps(first.readStateSince, second.readStateSince);
    if (delta) return delta;
  }
  return (first.readStateVersion ?? -1) - (second.readStateVersion ?? -1);
}

// Retain the server's sub-millisecond precision before using IDs to break exact ties.
export function compareTimestamps(first: string, second: string) {
  const firstTime = Date.parse(first), secondTime = Date.parse(second);
  const delta = (Number.isFinite(firstTime) ? firstTime : 0) - (Number.isFinite(secondTime) ? secondTime : 0);
  if (delta) return delta;
  const fraction = (value: string, valid: boolean) => (valid ? value.match(/\.(\d+)/)?.[1] ?? '' : '').padEnd(9, '0');
  const a = fraction(first, Number.isFinite(firstTime)), b = fraction(second, Number.isFinite(secondTime));
  return a === b ? 0 : a < b ? -1 : 1;
}

export function compareMessageOrder(first: Pick<ChatMessage, 'createdAt' | 'messageId'>, second: Pick<ChatMessage, 'createdAt' | 'messageId'>) {
  return compareTimestamps(first.createdAt, second.createdAt) || first.messageId - second.messageId;
}

export function compareConversationActivity(first: Conversation, second: Conversation) {
  const timestamp = (item: Conversation) => item.lastMessageAt && Number.isFinite(Date.parse(item.lastMessageAt)) ? item.lastMessageAt : item.updatedAt;
  return compareTimestamps(timestamp(first), timestamp(second)) || second.conversationId - first.conversationId;
}
