export type User = {
  id: number;
  username: string;
  displayName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type LocationPoint = {
  latitude: number;
  longitude: number;
};

export type LoginRequest = {
  username: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  tokenType: string;
};

export type RegisterRequest = {
  username: string;
  password: string;
  displayName: string;
};

export type UserSearchResult = {
  userId: number;
  displayName: string;
  username: string;
  relationship: FriendRelationship;
};

export type FriendRelationship = 'NONE' | 'FRIENDS' | 'PENDING_OUTGOING' | 'PENDING_INCOMING';

export type FriendSummary = {
  userId: number;
  username: string;
  displayName: string;
};

export type FriendRequestUser = FriendSummary;

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

export type FriendListResponse = { items: FriendSummary[] };
export type FriendRequestListResponse = { items: FriendRequestItem[] };

export type ConversationUser = FriendSummary;

export type Conversation = {
  conversationId: number;
  type: string;
  participant: ConversationUser;
  updatedAt: string;
  lastMessage: string | null;
};

export type ConversationListResponse = { items: Conversation[] };

export type ConversationDetail = {
  conversationId: number;
  type: string;
  participants: ConversationUser[];
  createdAt: string;
  updatedAt: string;
};

export type OpenDirectConversationResponse = {
  conversationId: number;
  type: string;
  participant: ConversationUser;
};

export type ChatMessage = {
  messageId: number;
  conversationId: number;
  senderId: number;
  content: string;
  createdAt: string;
};

export type MessageListResponse = {
  items: ChatMessage[];
  total: number;
  page: number;
  size: number;
};

export type SendMessageRequest = { content: string };

export type NotificationType = 'FRIEND_REQUEST_RECEIVED' | 'FRIEND_REQUEST_ACCEPTED' | 'NEW_MESSAGE';
export type NotificationReferenceType = 'FRIEND_REQUEST' | 'MESSAGE';

export type AppNotification = {
  id: number;
  recipientId: number;
  type: NotificationType;
  title: string;
  message: string;
  referenceType: NotificationReferenceType;
  referenceId: number;
  conversationId: number | null;
  read: boolean;
  createdAt: string;
  readAt: string | null;
};

export type NotificationListResponse = {
  items: AppNotification[];
  unreadCount: number;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type UnreadNotificationCount = { unreadCount: number };

export type NearbyUser = {
  userId: number;
  displayName: string;
  distanceMeters: number;
};

export type UserSearchResponse = {
  items: UserSearchResult[];
};

export type NearbyUsersResponse = {
  items: NearbyUser[];
  radiusMeters: number;
};
