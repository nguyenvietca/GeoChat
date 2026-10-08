import { ChatUserSummary } from './chat';

export type GroupInfo = {
  groupId: number;
  name: string;
  owner: ChatUserSummary;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type GroupMember = {
  user: ChatUserSummary;
  role: 'OWNER' | 'MEMBER' | string;
  joinedAt: string;
};

export type GroupMembersResponse = {
  items: GroupMember[];
};

export type CreateGroupRequest = {
  name: string;
  memberIds: number[];
};