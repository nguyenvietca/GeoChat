import { apiRequest } from './client';
import { CreateGroupRequest, GroupInfo, GroupMembersResponse } from '../types';

export const GROUP_NAME_MAX_LENGTH = 100;

// Must match the backend app.chat.max-group-members setting.
const configuredMax = Number(import.meta.env.VITE_MAX_GROUP_MEMBERS);
export const MAX_GROUP_MEMBERS = Number.isSafeInteger(configuredMax) && configuredMax > 0 ? configuredMax : 100;

export function createGroup(payload: CreateGroupRequest, token: string) {
  return apiRequest<GroupInfo>('/api/v1/groups', { method: 'POST', body: payload, token });
}

export function getGroup(groupId: number, token: string) {
  return apiRequest<GroupInfo>(`/api/v1/groups/${groupId}`, { token });
}

export function renameGroup(groupId: number, name: string, token: string) {
  return apiRequest<GroupInfo>(`/api/v1/groups/${groupId}`, { method: 'PATCH', body: { name }, token });
}

export function getGroupMembers(groupId: number, token: string) {
  return apiRequest<GroupMembersResponse>(`/api/v1/groups/${groupId}/members`, { token });
}

export function leaveGroup(groupId: number, token: string) {
  return apiRequest<void>(`/api/v1/groups/${groupId}/members/me`, { method: 'DELETE', token });
}

export function deleteGroup(groupId: number, token: string) {
  return apiRequest<void>(`/api/v1/groups/${groupId}`, { method: 'DELETE', token });
}

export function addGroupMembers(groupId: number, memberIds: number[], token: string) {
  return apiRequest<GroupInfo>(`/api/v1/groups/${groupId}/members`, { method: 'POST', body: { memberIds }, token });
}

export function removeGroupMember(groupId: number, userId: number, token: string) {
  return apiRequest<GroupInfo>(`/api/v1/groups/${groupId}/members/${userId}`, { method: 'DELETE', token });
}
