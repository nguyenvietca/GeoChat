import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './client';
import { searchUsers, updateMyAvatar, updateMyProfile } from './users';

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

  it('uploads an avatar as multipart form data', () => {
    const image = new File(['photo'], 'avatar.png', { type: 'image/png' });
    updateMyAvatar(image, 'jwt');
    const options = mockApiRequest.mock.calls[0][1] as { method: string; body: FormData; token: string };
    expect(mockApiRequest.mock.calls[0][0]).toBe('/api/v1/users/me/avatar');
    expect(options.method).toBe('POST');
    expect(options.token).toBe('jwt');
    expect(options.body.get('image')).toBe(image);
  });

  it('keeps user search on the centralized API client', () => {
    searchUsers('mira', 'jwt');

    expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/users/search?q=mira', { token: 'jwt' });
  });
});
