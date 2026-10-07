import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './client';
import { searchUsers, updateMyProfile } from './users';

vi.mock('./client', () => ({ apiRequest: vi.fn() }));
const mockApiRequest = vi.mocked(apiRequest);

describe('user API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates only the supported current-user profile field through the authenticated client', () => {
    updateMyProfile({ displayName: 'Mira Vale' }, 'jwt');

    expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/users/me', {
      method: 'PATCH',
      body: { displayName: 'Mira Vale' },
      token: 'jwt',
    });
  });

  it('keeps user search on the centralized API client', () => {
    searchUsers('mira', 'jwt');

    expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/users/search?q=mira', { token: 'jwt' });
  });
});