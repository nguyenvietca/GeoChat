export type ChatUserSummary = {
  userId: number;
  username: string;
  displayName: string;
};

export type Conversation = {
  conversationId: number;
  type: string;
  participant: ChatUserSummary;
  updatedAt: string;
  lastMessage: string | null;
};

export type ConversationListResponse = {
  items: Conversation[];
};

export type ConversationDetail = {
  conversationId: number;
  type: string;
  participants: ChatUserSummary[];
  createdAt: string;
  updatedAt: string;
};

export type OpenDirectConversationResponse = {
  conversationId: number;
  type: string;
  participant: ChatUserSummary;
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

export type SendMessageRequest = {
  content: string;
};