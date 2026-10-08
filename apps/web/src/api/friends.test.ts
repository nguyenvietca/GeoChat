import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './client';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  getFriends,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  removeFriend,
  rejectFriendRequest,
  sendFriendRequest,
} from './friends';

vi.mock('./client', () => ({ apiRequest: vi.fn() }));
const mockApiRequest = vi.mocked(apiRequest);

describe('friend API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads friends and both request lists through the authenticated client', () => {
    getFriends('jwt');
    getIncomingFriendRequests('jwt');
    getOutgoingFriendRequests('jwt');

    expect(mockApiRequest).toHaveBeenNthCalledWith(1, '/api/v1/friends', { token: 'jwt' });
    expect(mockApiRequest).toHaveBeenNthCalledWith(2, '/api/v1/friends/requests/incoming', { token: 'jwt' });
    expect(mockApiRequest).toHaveBeenNthCalledWith(3, '/api/v1/friends/requests/outgoing', { token: 'jwt' });
  });

  it('sends, accepts, rejects and cancels requests using the backend paths', () => {
    sendFriendRequest(18, 'jwt');
    acceptFriendRequest(21, 'jwt');
    rejectFriendRequest(22, 'jwt');
    cancelFriendRequest(23, 'jwt');

    expect(mockApiRequest).toHaveBeenNthCalledWith(1, '/api/v1/friends/requests', {
      method: 'POST', body: { userId: 18 }, token: 'jwt',
    });
    expect(mockApiRequest).toHaveBeenNthCalledWith(2, '/api/v1/friends/requests/21/accept', { method: 'POST', token: 'jwt' });
    expect(mockApiRequest).toHaveBeenNthCalledWith(3, '/api/v1/friends/requests/22/reject', { method: 'POST', token: 'jwt' });
    expect(mockApiRequest).toHaveBeenNthCalledWith(4, '/api/v1/friends/requests/23/cancel', { method: 'POST', token: 'jwt' });
  });

  it('removes a friend using the authenticated DELETE endpoint', () => {
    removeFriend(18, 'jwt');

    expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/friends/18', { method: 'DELETE', token: 'jwt' });
  });
});