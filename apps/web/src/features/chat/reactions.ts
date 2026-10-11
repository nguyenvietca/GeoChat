import { ChatMessage, MessageReactionState } from '../../types';

export const supportedReactions = [
  { key: 'thumbs-up', emoji: '👍', label: 'Thumbs up' },
  { key: 'heart', emoji: '❤️', label: 'Heart' },
  { key: 'laugh', emoji: '😂', label: 'Laugh' },
  { key: 'surprised', emoji: '😮', label: 'Surprised' },
  { key: 'sad', emoji: '😢', label: 'Sad' },
  { key: 'angry', emoji: '😡', label: 'Angry' },
] as const;

export function applyReactionState(message: ChatMessage, state?: MessageReactionState): ChatMessage {
  if (!state || message.messageId !== state.messageId || state.version < (message.reactionVersion ?? 0)) {
    return message;
  }
  return { ...message, reactions: state.reactions, reactionVersion: state.version };
} 
