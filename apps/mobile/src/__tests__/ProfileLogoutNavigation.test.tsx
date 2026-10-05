import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '../auth/AuthContext';
import { AppNavigator } from '../navigation/AppNavigator';
import { getCurrentUser } from '../api/authApi';
import { getToken, clearTokens } from '../storage/tokenStorage';
import { getUnreadNotificationCount } from '../api/notificationApi';
import { getMyProfile } from '../api/userApi';
import { User } from '../types/auth';

jest.mock('../api/authApi', () => ({
  getCurrentUser: jest.fn(),
  loginUser: jest.fn(),
  registerUser: jest.fn(),
}));
jest.mock('../storage/tokenStorage', () => ({
  getToken: jest.fn(),
  clearTokens: jest.fn(),
  saveTokens: jest.fn(),
}));
jest.mock('../api/notificationApi', () => ({
  getUnreadNotificationCount: jest.fn(),
}));
jest.mock('../api/userApi', () => ({
  getMyProfile: jest.fn(),
  updateMyProfile: jest.fn(),
  searchUsers: jest.fn(),
}));

const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;
const mockGetToken = getToken as jest.MockedFunction<typeof getToken>;
const mockClearTokens = clearTokens as jest.MockedFunction<typeof clearTokens>;
const mockGetUnreadCount = getUnreadNotificationCount as jest.MockedFunction<typeof getUnreadNotificationCount>;
const mockGetProfile = getMyProfile as jest.MockedFunction<typeof getMyProfile>;

const user: User = {
  id: 1,
  username: 'profile-user',
  displayName: 'Profile User',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

describe('profile navigation and logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetToken.mockResolvedValue('active-token');
    mockGetCurrentUser.mockResolvedValue(user);
    mockGetProfile.mockResolvedValue(user);
    mockGetUnreadCount.mockResolvedValue({ unreadCount: 0 });
    mockClearTokens.mockResolvedValue(undefined);
  });

  it('returns to Login and removes authenticated screens after logout', async () => {
    render(
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText('Search users')).toBeTruthy());
    fireEvent.press(screen.getByText('Profile'));
    await waitFor(() => expect(screen.getByText('@profile-user')).toBeTruthy());

    fireEvent.press(screen.getByText('Settings'));
    expect(screen.getByText('Password changes are not available yet.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(screen.getByText('Welcome back')).toBeTruthy());
    expect(mockClearTokens).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Profile User')).toBeNull();
    expect(screen.queryByText('Password changes are not available yet.')).toBeNull();
  });
});
