import { describe, expect, it } from 'vitest';
import { applyReactionState } from './reactions';
import { mergeMessages } from './ChatPanel';
import { ChatMessage, MessageReactionState } from '../../types';

const message: ChatMessage = { messageId: 1, conversationId: 41, senderId: 9, content: 'Hi', createdAt: '2026-10-10T10:00:00Z' };
const state: MessageReactionState = { messageId: 1, version: 3, reactions: [{ emoji: '❤️', count: 2, reactedByMe: true }] };
describe('reaction reconciliation', () => {
  it('accepts snapshots, tolerates duplicates and rejects older or unrelated versions', () => {
    const updated = applyReactionState(message, state);
    expect(updated.reactions).toEqual(state.reactions);
    expect(applyReactionState(updated, state)).toEqual(updated);
    expect(applyReactionState(updated, { ...state, version: 2, reactions: [] })).toBe(updated);
    expect(applyReactionState(updated, { ...state, messageId: 2 })).toBe(updated);
  });
  it('preserves newer reaction state when older history arrives, deduplicates and preserves order', () => {
    const updated = applyReactionState(message, state);
    const older = { ...message, messageId: 2, createdAt: '2026-10-09T10:00:00Z' };
    const merged = mergeMessages([updated], [message, older]);
    expect(merged.map((item) => item.messageId)).toEqual([2, 1]);
    expect(merged[1].reactions).toEqual(state.reactions);
  });
});
