import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './client';
import { addGroupMembers, getGroupMembers, removeGroupMember, renameGroup } from './groups';

vi.mock('./client', () => ({ apiRequest: vi.fn() }));
const mockApiRequest = vi.mocked(apiRequest);

describe('group API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the existing group endpoints for metadata and membership operations', () => {
    renameGroup(42, 'Weekend crew', 'jwt');
    getGroupMembers(42, 'jwt');
    addGroupMembers(42, [18], 'jwt');
    removeGroupMember(42, 18, 'jwt');

    expect(mockApiRequest).toHaveBeenNthCalledWith(1, '/api/v1/groups/42', {
      method: 'PATCH', body: { name: 'Weekend crew' }, token: 'jwt',
    });
    expect(mockApiRequest).toHaveBeenNthCalledWith(2, '/api/v1/groups/42/members', { token: 'jwt' });
    expect(mockApiRequest).toHaveBeenNthCalledWith(3, '/api/v1/groups/42/members', {
      method: 'POST', body: { memberIds: [18] }, token: 'jwt',
    });
    expect(mockApiRequest).toHaveBeenNthCalledWith(4, '/api/v1/groups/42/members/18', { method: 'DELETE', token: 'jwt' });
  });
});