import { apiRequest } from './client';
import {
  ChatMessage,
  ConversationDetail,
  ConversationListResponse,
  ConversationPresenceResponse,
  MessageListResponse,
  OpenDirectConversationResponse,
  SendMessageRequest,
} from '../types';

export function getConversations(token: string) {
  return apiRequest<ConversationListResponse>('/api/v1/chats', { token });
}

export function getConversationDetail(conversationId: number, token: string) {
  return apiRequest<ConversationDetail>(`/api/v1/chats/${conversationId}`, { token });
}

export function openDirectConversation(userId: number, token: string) {
  return apiRequest<OpenDirectConversationResponse>('/api/v1/chats/direct', {
    method: 'POST',
    body: { userId },
    token,
  });
}

export function getMessages(conversationId: number, page: number, limit: number, token: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiRequest<MessageListResponse>(`/api/v1/chats/${conversationId}/messages?${params}`, { token });
}

export function sendMessage(conversationId: number, payload: SendMessageRequest, token: string) {
  return apiRequest<ChatMessage>(`/api/v1/chats/${conversationId}/messages`, {
    method: 'POST',
    body: payload,
    token,
  });
}

export function openContextualConversation(userId: number, radiusMeters: number | undefined, token: string) {
  return apiRequest<OpenDirectConversationResponse>('/api/v1/chats/contextual', {
    method: 'POST',
    body: { userId, ...(radiusMeters === undefined ? {} : { radiusMeters }) },
    token,
  });
}

export function getConversationPresence(conversationId: number, token: string) {
  return apiRequest<ConversationPresenceResponse>(`/api/v1/chats/${conversationId}/presence`, { token });
}