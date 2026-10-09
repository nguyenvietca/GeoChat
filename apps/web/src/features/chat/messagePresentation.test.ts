import { describe, expect, it } from 'vitest';
import { activityTime, formatConversationTime, formatMessageTime, updateConversation } from './messagePresentation';

describe('message presentation', () => {
  it('formats today, yesterday, older and invalid times without throwing', () => {
    const now = new Date(2026, 9, 10, 12);
    const today = new Date(2026, 9, 10, 10, 32).toISOString();
    expect(formatConversationTime(today, now)).toBe(formatMessageTime(today));
    expect(formatConversationTime(new Date(2026, 9, 9, 10).toISOString(), now)).toBe('Yesterday');
    expect(formatConversationTime('2025-01-01T00:00:00Z', now)).toContain('2025');
    for (const value of [null, undefined, '', 'invalid']) expect(formatConversationTime(value, now)).toBe('');
    expect(formatMessageTime('invalid')).toBe('');
  });
  it('uses latest message time over metadata updates and ignores old or duplicate events', () => {
    const item = { conversationId: 1, type: 'GROUP', participant: { userId: 2, username: 'a', displayName: 'A' },
      lastMessage: 'Hello', updatedAt: '2026-10-10T12:00:00Z', lastMessageAt: '2026-10-08T12:00:00Z', lastMessageId: 3 };
    expect(activityTime(item)).toBe(Date.parse(item.lastMessageAt));
    expect(activityTime({ ...item, lastMessageAt: null })).toBe(Date.parse(item.updatedAt));
    const message = { messageId: 2, conversationId: 1, senderId: 2, content: 'Old', createdAt: '2026-10-07T12:00:00Z' };
    expect(updateConversation(item, message)).toBe(item);
    expect(updateConversation(item, { ...message, messageId: 3 })).toBe(item);
  });
});
