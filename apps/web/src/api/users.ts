import { apiRequest } from './client';
import { User, UserSearchResponse } from '../types';

export type UpdateMyProfileRequest = { displayName: string; email?: string | null; phoneNumber?: string | null };

export function updateMyProfile(payload: UpdateMyProfileRequest, token: string) {
  return apiRequest<User>('/api/v1/users/me', {
    method: 'PATCH',
    body: payload,
    token,
  });
}

export function updateMyAvatar(image: File, token: string) {
  const body = new FormData();
  body.append('image', image);
  return apiRequest<User>('/api/v1/users/me/avatar', { method: 'POST', body, token });
}

export function searchUsers(query: string, token: string, page = 0) {
  const params = new URLSearchParams({ q: query });
  if (page > 0) params.set('page', String(page));
  return apiRequest<UserSearchResponse>(`/api/v1/users/search?${params.toString()}`, { token });
}
export function getPublicProfile(id:number,token:string){return apiRequest<{userId:number;username:string;displayName:string;avatarUpdatedAt?:string|null}>(`/api/v1/users/${id}/profile`,{token});}
