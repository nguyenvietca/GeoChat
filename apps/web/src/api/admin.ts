import { apiRequest } from './client';
export type AdminOverview = { total: number; active: number; inactive: number; blocked: number; online: number; measuredAt: string; newUsers7Days?: number };
export const getAdminOverview = (token: string, signal?: AbortSignal) => apiRequest<AdminOverview>('/api/v1/admin/overview', { token, signal });
export const openAdminConversation = (token: string, id: number) => apiRequest<{ conversationId: number }>(`/api/v1/admin/users/${id}/conversation`, { method: 'POST', token });

export type AuditRow = { id: number; actorId: number; actor: string | null; targetId: number; target: string | null; action: string; reason: string | null; createdAt: string; previousStatus: string | null; newStatus: string | null; previousRole: string | null; newRole: string | null };
export type AdminDetail = { user: import('./accounts').AdminUser; history: AuditRow[] };
export const getAdminUser = (token: string, id: string, signal?: AbortSignal) => apiRequest<AdminDetail>('/api/v1/admin/users/' + id, { token, signal });
export const getAdminAudit = (token: string, filters: Record<string,string>, signal?: AbortSignal) => apiRequest<{ items: AuditRow[]; hasMore: boolean }>('/api/v1/admin/audit-logs?' + new URLSearchParams(filters), { token, signal });
