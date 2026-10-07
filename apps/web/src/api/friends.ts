import { apiRequest } from './client';
import {
  FriendListResponse,
  FriendRequestListResponse,
  FriendRequestResponse,
} from '../types';

export function getFriends(token: string) {
  return apiRequest<FriendListResponse>('/api/v1/friends', { token });
}

export function getIncomingFriendRequests(token: string) {
  return apiRequest<FriendRequestListResponse>('/api/v1/friends/requests/incoming', { token });
}

export function getOutgoingFriendRequests(token: string) {
  return apiRequest<FriendRequestListResponse>('/api/v1/friends/requests/outgoing', { token });
}

export function sendFriendRequest(userId: number, token: string) {
  return apiRequest<FriendRequestResponse>('/api/v1/friends/requests', {
    method: 'POST',
    body: { userId },
    token,
  });
}

export function acceptFriendRequest(requestId: number, token: string) {
  return updateFriendRequest(requestId, 'accept', token);
}

export function rejectFriendRequest(requestId: number, token: string) {
  return updateFriendRequest(requestId, 'reject', token);
}

export function cancelFriendRequest(requestId: number, token: string) {
  return updateFriendRequest(requestId, 'cancel', token);
}

function updateFriendRequest(requestId: number, action: 'accept' | 'reject' | 'cancel', token: string) {
  return apiRequest<FriendRequestResponse>(`/api/v1/friends/requests/${requestId}/${action}`, {
    method: 'POST',
    token,
  });
}