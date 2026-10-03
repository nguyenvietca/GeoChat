import { apiRequest } from './client';
import {
  CurrentLocation,
  NearbyUsersResponse,
  UpdateLocationRequest,
} from '../types/discovery';

export function getMyLocation(token: string) {
  return apiRequest<CurrentLocation>('/api/v1/locations/me', { token });
}

export function updateMyLocation(payload: UpdateLocationRequest, token: string) {
  return apiRequest<CurrentLocation>('/api/v1/locations/me', {
    method: 'POST',
    body: payload,
    token,
  });
}

export function getNearbyUsers(token: string, radius = 5000, limit = 20) {
  const query = new URLSearchParams({ radius: String(radius), limit: String(limit) });
  return apiRequest<NearbyUsersResponse>(`/api/v1/locations/nearby?${query.toString()}`, { token });
}