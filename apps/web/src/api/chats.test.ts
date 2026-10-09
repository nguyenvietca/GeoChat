import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './client';
import {
  getConversationDetail,
  getConversationPresence,
  getConversations,
  getMessages,
  openDirectConversation,
  openDiscoveryConversation,
  openContextualConversation,
  sendMessage,
} from './chats';

vi.mock('./client', () => ({ apiRequest: vi.fn() }));
const mockApiRequest = vi.mocked(apiRequest);

describe('chat API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads conversation list and protected detail', () => {
    getConversations('jwt');
    getConversationDetail(42, 'jwt');
    getConversationPresence(42, 'jwt');

    expect(mockApiRequest).toHaveBeenNthCalledWith(1, '/api/v1/chats', { token: 'jwt' });
    expect(mockApiRequest).toHaveBeenNthCalledWith(2, '/api/v1/chats/42', { token: 'jwt' });
    expect(mockApiRequest).toHaveBeenNthCalledWith(3, '/api/v1/chats/42/presence', { token: 'jwt' });
  });

  it('opens an idempotent direct conversation with a friend', () => {
    openDirectConversation(18, 'jwt');

    expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/chats/direct', {
      method: 'POST', body: { userId: 18 }, token: 'jwt',
    });
  });

  it('opens a discovery chat without requiring friendship or a nearby radius', () => {
    openDiscoveryConversation(18, 'jwt');
    expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/chats/discovery', {
      method: 'POST', body: { userId: 18 }, token: 'jwt',
    });
  });

  it('opens a server-validated contextual chat with the requested nearby radius', () => {
    openContextualConversation(18, 5000, 'jwt');
    expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/chats/contextual', {
      method: 'POST', body: { userId: 18, radiusMeters: 5000 }, token: 'jwt',
    });
  });

  it('uses the backend page/limit history contract and persists messages through REST', () => {
    getMessages(42, 2, 20, 'jwt');
    sendMessage(42, { content: 'hello' }, 'jwt');

    expect(mockApiRequest).toHaveBeenNthCalledWith(1, '/api/v1/chats/42/messages?page=2&limit=20', { token: 'jwt' });
    expect(mockApiRequest).toHaveBeenNthCalledWith(2, '/api/v1/chats/42/messages', {
      method: 'POST', body: { content: 'hello' }, token: 'jwt',
    });
  });
});