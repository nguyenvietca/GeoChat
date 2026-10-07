import { apiRequest } from './client';
import { User, UserSearchResponse } from '../types';

export type UpdateMyProfileRequest = { displayName: string };

export function updateMyProfile(payload: UpdateMyProfileRequest, token: string) {
  return apiRequest<User>('/api/v1/users/me', {
    method: 'PATCH',
    body: payload,
    token,
  });
}

export function searchUsers(query: string, token: string) {
  const params = new URLSearchParams({ q: query });
  return apiRequest<UserSearchResponse>(`/api/v1/users/search?${params.toString()}`, { token });
}