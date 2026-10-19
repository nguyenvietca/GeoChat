import { apiRequest } from './client';
import type { LoginResponse } from '../types';

export const deactivateAccount = (token: string, password: string) => apiRequest<null>('/api/v1/users/me/deactivate', { method: 'POST', token, body: { password } });
export const reactivateAccount = (token: string) => apiRequest<LoginResponse>('/api/v1/users/me/reactivate', { method: 'POST', token });
export type AdminUser = { id: number; username: string; displayName: string; status: string; role: string; blockReason: string | null; email?: string | null; createdAt?: string; providers?: string[] };
export const listAdminUsers = (token: string, query: string, page: number, filters: Record<string,string> = {}, signal?: AbortSignal) => apiRequest<{ items: AdminUser[]; hasMore: boolean }>(`/api/v1/admin/users?query=${encodeURIComponent(query)}&page=${page}&${new URLSearchParams(filters)}`, { token, signal });
export const moderateAccount = (token: string, id: number, block: boolean, reason: string) => apiRequest<null>(`/api/v1/admin/users/${id}/${block ? 'block' : 'unblock'}`, { method: 'POST', token, body: { reason } });
