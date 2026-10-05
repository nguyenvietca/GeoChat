import { apiRequest } from './client';
import { AuthTokens, LoginRequest, RegisterRequest, User } from '../types/auth';
import { getMyProfile } from './userApi';

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

export const getCurrentUser = getMyProfile;
