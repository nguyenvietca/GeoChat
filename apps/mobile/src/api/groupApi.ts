import { apiRequest } from './client';
import { CreateGroupRequest, GroupInfo, GroupMembersResponse } from '../types/group';

export function createGroup(payload: CreateGroupRequest, token: string) {
  return apiRequest<GroupInfo>('/api/v1/groups', {
    method: 'POST',
    body: payload,
    token,
  });
}

export function getGroup(groupId: number, token: string) {
  return apiRequest<GroupInfo>(`/api/v1/groups/${groupId}`, { token });
}

export function getGroupMembers(groupId: number, token: string) {
  return apiRequest<GroupMembersResponse>(`/api/v1/groups/${groupId}/members`, { token });
}

export function leaveGroup(groupId: number, token: string) {
  return apiRequest<void>(`/api/v1/groups/${groupId}/members/me`, {
    method: 'DELETE',
    token,
  });
}