jest.mock('../api/client', () => ({ apiRequest: jest.fn() }));

import { apiRequest } from '../api/client';
import { createGroup, getGroup, getGroupMembers, leaveGroup } from '../api/groupApi';

const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('groupApi', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the backend group endpoints and payload shapes', async () => {
    const info = { groupId: 12, name: 'Hikers', memberCount: 2 };
    mockApiRequest.mockResolvedValue(info);

    await createGroup({ name: 'Hikers', memberIds: [2] }, 'token');
    expect(mockApiRequest).toHaveBeenLastCalledWith('/api/v1/groups', {
      method: 'POST',
      body: { name: 'Hikers', memberIds: [2] },
      token: 'token',
    });

    await getGroup(12, 'token');
    expect(mockApiRequest).toHaveBeenLastCalledWith('/api/v1/groups/12', { token: 'token' });

    await getGroupMembers(12, 'token');
    expect(mockApiRequest).toHaveBeenLastCalledWith('/api/v1/groups/12/members', { token: 'token' });

    await leaveGroup(12, 'token');
    expect(mockApiRequest).toHaveBeenLastCalledWith('/api/v1/groups/12/members/me', {
      method: 'DELETE',
      token: 'token',
    });
  });
});