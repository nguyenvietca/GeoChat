import { apiRequest } from './client';
import { AuthTokens, LoginRequest, RegisterRequest, User } from '../types/auth';

export const loginUser = async (payload: LoginRequest) => {
  return apiRequest<AuthTokens>('/api/v1/auth/login', {
    method: 'POST',
    body: payload,
  });
};

export const registerUser = async (payload: RegisterRequest) => {
  return apiRequest<User>('/api/v1/auth/register', {
    method: 'POST',
    body: payload,
  });
};

export const getCurrentUser = async (token: string) => {
  return apiRequest<User>('/api/v1/users/me', {
    method: 'GET',
    token,
  });
};
