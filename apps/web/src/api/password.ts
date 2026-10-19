import { apiRequest } from './client';
export const passwordRecoveryConfig = () => apiRequest<{ enabled: boolean }>('/api/v1/auth/password/config');
export const requestPasswordReset = (email: string) => apiRequest<null>('/api/v1/auth/password/forgot', { method: 'POST', body: { email } });
export const resetPassword = (token: string, password: string) => apiRequest<null>('/api/v1/auth/password/reset', { method: 'POST', body: { token, password } });
