import { apiRequest } from './client';
export type AdminOverview = { total: number; active: number; inactive: number; blocked: number; online: number; measuredAt: string };
export const getAdminOverview = (token: string, signal?: AbortSignal) => apiRequest<AdminOverview>('/api/v1/admin/overview', { token, signal });
export const openAdminConversation = (token: string, id: number) => apiRequest<{ conversationId: number }>(`/api/v1/admin/users/${id}/conversation`, { method: 'POST', token });
