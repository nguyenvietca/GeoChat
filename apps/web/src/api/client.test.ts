import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, setUnauthorizedHandler } from './client';

afterEach(() => {
  vi.unstubAllGlobals();
  setUnauthorizedHandler(null);
});

describe('web API client', () => {
  it('attaches the bearer token centrally and parses the API envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, data: { id: 3 }, message: 'OK' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest<{ id: number }>('/api/v1/users/me', { token: 'access-token' }))
      .resolves.toEqual({ id: 3 });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v1\/users\/me$/), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
    }));
  });

  it('notifies auth state on 401 and returns a typed API error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => '' });
    const onUnauthorized = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    setUnauthorizedHandler(onUnauthorized);

    await expect(apiRequest('/api/v1/users/me', { token: 'expired' }))
      .rejects.toMatchObject({ status: 401, message: 'Your session has expired. Please sign in again.' });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});