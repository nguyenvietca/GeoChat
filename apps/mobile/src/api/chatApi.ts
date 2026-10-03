import { apiRequest } from './client';
import {
  ChatMessage,
  ConversationDetail,
  ConversationListResponse,
  MessageListResponse,
  OpenDirectConversationResponse,
  SendMessageRequest,
} from '../types/chat';

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

export function getMessages(conversationId: number, token: string, page = 0, limit = 20) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiRequest<MessageListResponse>(`/api/v1/chats/${conversationId}/messages?${query.toString()}`, { token });
}

export function sendMessage(conversationId: number, payload: SendMessageRequest, token: string) {
  return apiRequest<ChatMessage>(`/api/v1/chats/${conversationId}/messages`, {
    method: 'POST',
    body: payload,
    token,
  });
}