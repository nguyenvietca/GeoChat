export type User = {
  id: number;
  username: string;
  displayName: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AuthTokens = {
  token: string;
  tokenType: string;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  message?: string;
  timestamp?: string;
};

export type LoginRequest = {
  username: string;
  password: string;
};

export type RegisterRequest = {
  username: string;
  password: string;
  displayName: string;
};
