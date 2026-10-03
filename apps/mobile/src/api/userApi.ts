import { apiRequest } from './client';
import { UserSearchResponse } from '../types/discovery';

export function searchUsers(query: string, token: string) {
  return apiRequest<UserSearchResponse>(`/api/v1/users/search?q=${encodeURIComponent(query)}`, {
    token,
  });
}