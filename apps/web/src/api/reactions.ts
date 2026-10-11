import { apiRequest } from './client';
import { MessageReactionState } from '../types';

export function setMessageReaction(conversationId: number, messageId: number, key: string, add: boolean, token: string) {
  return apiRequest<MessageReactionState>(`/api/v1/chats/${conversationId}/messages/${messageId}/reactions/${key}`, {
    method: add ? 'PUT' : 'DELETE', token,
  });
}

export function getMessageReactions(conversationId: number, messageIds: number[], token: string) {
  const params = new URLSearchParams({ messageIds: messageIds.join(',') });
  return apiRequest<{ items: MessageReactionState[] }>(`/api/v1/chats/${conversationId}/reactions?${params}`, { token });
}
