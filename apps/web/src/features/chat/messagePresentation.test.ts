import { describe, expect, it } from 'vitest';
import { activityTime, compareMessageOrder, applyUnreadState, mergeConversationSnapshot, formatConversationTime, formatMessageTime, updateConversation } from './messagePresentation';

describe('message presentation', () => {
  it('keeps newer authoritative read state when a stale list or activity arrives', () => {
    const item = { conversationId: 1, type: 'DIRECT', participant: { userId: 2, username: 'a', displayName: 'A' }, updatedAt: '', lastMessage: null, unreadCount: 0, readStateVersion: 5 };
    expect(applyUnreadState(item, { conversationId: 1, unreadCount: 3, readStateVersion: 4 })).toBe(item);
    expect(mergeConversationSnapshot({ ...item, unreadCount: 3, readStateVersion: 4 }, item).unreadCount).toBe(0);
    expect(applyUnreadState(item, { conversationId: 1, unreadCount: 1, readStateVersion: 6 }).unreadCount).toBe(1);
  });
  it('accepts a fresh group membership lifetime and ignores delayed state from the previous membership', () => {
    const item = { conversationId: 1, type: 'GROUP', participant: { userId: 2, username: 'a', displayName: 'A' }, updatedAt: '', lastMessage: null, unreadCount: 2, readStateVersion: 50, readStateSince: '2026-10-10T12:00:00.123456Z' };
    const fresh = applyUnreadState(item, { conversationId: 1, unreadCount: 0, readStateVersion: 0, readStateSince: '2026-10-10T12:00:00.123457Z' });
    expect(fresh.unreadCount).toBe(0);
    expect(applyUnreadState(fresh, { conversationId: 1, unreadCount: 10, readStateVersion: 100, readStateSince: item.readStateSince })).toBe(fresh);
  });
  it('uses timestamp precision before ID when messages fall within the same millisecond', () => {
    expect(compareMessageOrder({ messageId: 100, createdAt: '2026-10-10T12:00:00.123456Z' },
      { messageId: 2, createdAt: '2026-10-10T12:00:00.123457Z' })).toBeLessThan(0);
    expect(compareMessageOrder({ messageId: 100, createdAt: '2026-10-10T12:00:00.1Z' },
      { messageId: 2, createdAt: '2026-10-10T12:00:00.100000Z' })).toBe(98);
  });
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
