export type Friend = {
  userId: number;
  displayName: string;
};

export type FriendRequestUser = {
  userId: number;
  displayName: string;
};

export type FriendRequestItem = {
  requestId: number;
  user: FriendRequestUser;
  createdAt: string;
};

export type FriendRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export type FriendRequestResponse = {
  requestId: number;
  senderId: number;
  receiverId: number;
  status: FriendRequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type FriendListResponse = {
  items: Friend[];
};

export type FriendRequestListResponse = {
  items: FriendRequestItem[];
};