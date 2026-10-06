import { apiRequest } from './client';
import { UserSearchResponse } from '../types';

export function searchUsers(query: string, token: string) {
  const params = new URLSearchParams({ q: query });
  return apiRequest<UserSearchResponse>(`/api/v1/users/search?${params.toString()}`, { token });
}