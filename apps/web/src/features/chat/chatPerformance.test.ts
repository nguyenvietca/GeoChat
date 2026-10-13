import { describe, expect, it } from 'vitest';
import { ChatMessage } from '../../types';
import { mergeMessages } from './ChatPanel';

function history(size: number): ChatMessage[] {
  return Array.from({ length: size }, (_, index) => ({
    messageId: index + 1,
    conversationId: 7,
    senderId: index % 2 + 1,
    content: `Message ${index + 1}`,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, Math.floor(index / 3))).toISOString(),
  }));
}

describe('large chat history reconciliation', () => {
  it.each([100, 1_000, 5_000])('keeps %i messages ordered and unique across overlapping pages and realtime events', (size) => {
    const items = history(size);
    const merged = mergeMessages(items.slice(20), [items[size - 1], ...items.slice(0, 40)]);
    expect(merged).toHaveLength(size);
    expect(new Set(merged.map(item => item.messageId)).size).toBe(size);
    expect(merged[0].messageId).toBe(1);
    expect(merged.at(-1)?.messageId).toBe(size);
  });
});
