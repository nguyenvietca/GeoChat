import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, apiImage, setUnauthorizedHandler } from './client';

afterEach(() => {
  vi.unstubAllGlobals();
  setUnauthorizedHandler(null);
});

describe('web API client', () => {
  it('sends multipart without overriding the boundary and loads private bytes without token URLs',async()=>{
    const fetchMock=vi.fn().mockResolvedValueOnce({ok:true,status:200,text:async()=>JSON.stringify({success:true,data:{id:1}})})
      .mockResolvedValueOnce({ok:true,status:200,blob:async()=>new Blob(['image'],{type:'image/png'})});
    vi.stubGlobal('fetch',fetchMock);
    const body=new FormData();body.append('image',new Blob(['image'],{type:'image/png'}),'photo.png');
    await apiRequest('/images',{method:'POST',body,token:'jwt'});
    const options=fetchMock.mock.calls[0][1];expect(options.body).toBe(body);expect(options.headers['Content-Type']).toBeUndefined();
    await apiImage('/api/v1/chats/images/1','jwt',new AbortController().signal);
    expect(fetchMock.mock.calls[1][0]).not.toContain('jwt');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({cache:'no-store',headers:{Authorization:'Bearer jwt'}});
  });

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

  it.each([
    [403, 'You do not have permission to perform this action.'],
    [413, 'The selected file is too large.'],
    [429, 'Too many requests. Please wait and try again.'],
  ])('provides safe fallback feedback for HTTP %s', async (status, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status, text: async () => '' }));
    await expect(apiRequest('/api/v1/action', { token: 'token' })).rejects.toMatchObject({ status, message });
  });
});
