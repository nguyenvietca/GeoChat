import { apiRequest } from './client';
import { User } from '../types/auth';
import { UserSearchResponse } from '../types/discovery';

export type UpdateMyProfileRequest = {
  displayName: string;
};

export function getMyProfile(token: string) {
  return apiRequest<User>('/api/v1/users/me', { token });
}

export function updateMyProfile(payload: UpdateMyProfileRequest, token: string) {
  return apiRequest<User>('/api/v1/users/me', {
    method: 'PATCH',
    body: payload,
    token,
  });
}

export function searchUsers(query: string, token: string) {
  return apiRequest<UserSearchResponse>(`/api/v1/users/search?q=${encodeURIComponent(query)}`, {
    token,
  });
}