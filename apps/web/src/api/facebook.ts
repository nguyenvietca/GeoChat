import { apiBaseUrl, apiRequest } from './client';

export type Provider = 'google' | 'facebook';
export type FacebookConnections = { passwordAvailable: boolean; facebookConnected: boolean; email: string | null };
const path = '/api/v1/auth/facebook';
export const facebookConfig = () => apiRequest<{ enabled: boolean }>(`${path}/config`);
export const facebookConnections = (token: string) => apiRequest<FacebookConnections>(`${path}/connections`, { token });
export const completeFacebook = (token?: string) => apiRequest<{ token: string | null; linked: boolean; nextUrl?: string | null }>(`${path}/complete`, { method: 'POST', token, credentials: 'include' });
export const unlinkFacebook = (token: string, password: string) => apiRequest<null>(`${path}/unlink`, { method: 'POST', token, body: { password }, credentials: 'include' });

export function redirectProvider(url: string) {
  if (!['/api/oauth2/authorization/google', '/api/oauth2/authorization/facebook'].includes(url)) throw new Error('Invalid sign-in destination.');
  window.location.assign(`${apiBaseUrl}${url}`);
}

export async function startFacebook(token?: string, password?: string) {
  const result = await apiRequest<{ url: string }>(`${path}/${token ? 'link' : 'start'}`, {
    method: 'POST', token, body: token ? { password } : undefined, credentials: 'include',
  });
  if (result.url !== '/api/oauth2/authorization/facebook') throw new Error('Invalid Facebook sign-in destination.');
  redirectProvider(result.url);
}

export async function reauthenticateProvider(provider: Provider, action: 'link' | 'unlink', token: string) {
  const result = await apiRequest<{ url: string }>(`/api/v1/auth/${provider}/reauth`, {
    method: 'POST', token, body: { action }, credentials: 'include',
  });
  redirectProvider(result.url);
}
