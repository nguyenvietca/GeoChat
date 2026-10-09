import { ChatMessage, Conversation } from '../../types';

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
  const previousTime = Date.parse(item.lastMessageAt ?? '');
  const nextTime = Date.parse(message.createdAt);
  if (Number.isFinite(previousTime) && (nextTime < previousTime
    || (nextTime === previousTime && message.messageId < (item.lastMessageId ?? 0)))) return item;
  return { ...item, lastMessage: message.content, lastMessageId: message.messageId,
    lastMessageAt: message.createdAt, lastMessageSender: sender ?? null };
}
