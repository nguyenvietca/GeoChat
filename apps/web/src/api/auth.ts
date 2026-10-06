import { apiRequest } from './client';
import { LoginRequest, LoginResponse, RegisterRequest, User } from '../types';

export function login(payload: LoginRequest) {
  return apiRequest<LoginResponse>('/api/v1/auth/login', { method: 'POST', body: payload });
}

export function register(payload: RegisterRequest) {
  return apiRequest<User>('/api/v1/auth/register', { method: 'POST', body: payload });
}

export function getCurrentUser(token: string) {
  return apiRequest<User>('/api/v1/users/me', { token });
}