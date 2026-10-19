import { apiBaseUrl, apiRequest } from './client';

const path = '/api/v1/auth/google';
export type Connections = { passwordAvailable: boolean; googleConnected: boolean; email: string | null };
export const googleConfig = () => apiRequest<{ enabled: boolean }>(`${path}/config`);
export const googleConnections = (token: string) => apiRequest<Connections>(`${path}/connections`, { token });
export const cancelGoogle = () => apiRequest<null>(`${path}/cancel`, { method: 'POST', credentials: 'include' });
export const completeGoogle = (token?: string) => apiRequest<{ token: string | null; linked: boolean; deactivated?: boolean; nextUrl?: string | null }>(`${path}/complete`, { method: 'POST', token, credentials: 'include' });
export const unlinkGoogle = (token: string, password: string) => apiRequest<null>(`${path}/unlink`, { method: 'POST', token, body: { password }, credentials: 'include' });
export async function startGoogle(token?: string, password?: string) {
  const result = await apiRequest<{ url: string }>(`${path}/${token ? 'link' : 'start'}`, {
    method: 'POST', token, body: token ? { password } : undefined, credentials: 'include',
  });
  // Do not follow an arbitrary URL, even if a backend/proxy returns one.
  if (result.url !== '/api/oauth2/authorization/google') throw new Error('Invalid Google sign-in destination.');
  window.location.assign(`${apiBaseUrl}${result.url}`);
}

export async function startGoogleAccountAction(action: 'deactivate', token?: string) {
  const result = await apiRequest<{ url: string }>(`${path}/${action}`, { method: 'POST', token, credentials: 'include' });
  if (result.url !== '/api/oauth2/authorization/google') throw new Error('Invalid Google sign-in destination.');
  window.location.assign(`${apiBaseUrl}${result.url}`);
}
