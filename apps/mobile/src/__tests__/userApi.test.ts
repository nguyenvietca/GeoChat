import { apiRequest } from '../api/client';
import { getMyProfile, updateMyProfile } from '../api/userApi';

jest.mock('../api/client', () => ({
  apiRequest: jest.fn(),
}));

const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('userApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the current authenticated profile', async () => {
    await getMyProfile('profile-token');

    expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/users/me', { token: 'profile-token' });
  });

  it('updates only the supported displayName field', async () => {
    await updateMyProfile({ displayName: 'Updated Name' }, 'profile-token');

    expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/users/me', {
      method: 'PATCH',
      body: { displayName: 'Updated Name' },
      token: 'profile-token',
    });
  });
});
