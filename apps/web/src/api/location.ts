import { apiRequest } from './client';
import { LocationPoint, NearbyUsersResponse } from '../types';

export function updateCurrentLocation(location: LocationPoint, token: string) {
  return apiRequest('/api/v1/locations/me', { method: 'POST', body: location, token });
}

export function getNearbyUsers(radiusMeters: number, token: string, page = 0) {
  const params = new URLSearchParams({ radius: String(radiusMeters) });
  if (page) params.set('page',String(page));
  return apiRequest<NearbyUsersResponse>(`/api/v1/locations/nearby?${params.toString()}`, { token });
}
export function getDiscoverability(token:string){return apiRequest<{discoverable:boolean}>('/api/v1/locations/discoverability',{token});}
export function setDiscoverability(discoverable:boolean,token:string){return apiRequest<{discoverable:boolean}>('/api/v1/locations/discoverability',{method:'PUT',body:{discoverable},token});}
