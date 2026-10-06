import { apiRequest } from './client';
import { LocationPoint, NearbyUsersResponse } from '../types';

export function updateCurrentLocation(location: LocationPoint, token: string) {
  return apiRequest('/api/v1/locations/me', { method: 'POST', body: location, token });
}

export function getNearbyUsers(radiusMeters: number, token: string) {
  const params = new URLSearchParams({ radius: String(radiusMeters) });
  return apiRequest<NearbyUsersResponse>(`/api/v1/locations/nearby?${params.toString()}`, { token });
}