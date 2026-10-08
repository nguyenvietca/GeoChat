import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '../auth/AuthContext';
import { AppNavigator } from '../navigation/AppNavigator';
import { getCurrentUser } from '../api/authApi';
import { getToken, clearTokens } from '../storage/tokenStorage';
import { getUnreadNotificationCount } from '../api/notificationApi';
import { unregisterCurrentPushDevice } from '../services/pushNotificationService';
import { getMyProfile } from '../api/userApi';
import { apiRequest } from '../api/client';
import { disconnectAllChatWebSockets, subscribeToNotifications } from '../services/chatWebSocketService';
import { User } from '../types/auth';
import { AppNotification } from '../types/notification';

const mockNotificationSocket = {
  handlers: null as unknown,
  cleanup: jest.fn(),
};

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
jest.mock('../services/pushNotificationService', () => ({
  registerForPushNotifications: jest.fn().mockResolvedValue('unavailable'),
  unregisterCurrentPushDevice: jest.fn().mockRejectedValue(new Error('network unavailable')),
  addPushNotificationListeners: jest.fn(() => jest.fn()),
}));
jest.mock('../services/chatWebSocketService', () => ({
  disconnectAllChatWebSockets: jest.fn(),
  subscribeToNotifications: jest.fn((_token: string, handlers: unknown) => {
    mockNotificationSocket.handlers = handlers;
    return mockNotificationSocket.cleanup;
  }),
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
const mockUnregisterPushDevice = unregisterCurrentPushDevice as jest.MockedFunction<typeof unregisterCurrentPushDevice>;
const mockGetProfile = getMyProfile as jest.MockedFunction<typeof getMyProfile>;
const mockDisconnectAll = disconnectAllChatWebSockets as jest.MockedFunction<typeof disconnectAllChatWebSockets>;
const mockSubscribeToNotifications = subscribeToNotifications as jest.MockedFunction<typeof subscribeToNotifications>;

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
    mockNotificationSocket.handlers = null;
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
    expect(mockUnregisterPushDevice).toHaveBeenCalledWith('active-token');
    expect(mockDisconnectAll).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Profile User')).toBeNull();
    expect(screen.queryByText('Password changes are not available yet.')).toBeNull();
  });

  it('clears the authenticated session and realtime connection after an API 401', async () => {
    render(
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText('Search users')).toBeTruthy());

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      status: 401,
      ok: false,
      text: async () => JSON.stringify({ success: false, message: 'Unauthorized' }),
    }) as unknown as typeof fetch;
    try {
      await act(async () => {
        await expect(apiRequest('/api/v1/users/me', { token: 'active-token' }))
          .rejects.toMatchObject({ status: 401 });
      });
      await waitFor(() => expect(screen.getByText('Welcome back')).toBeTruthy());
      expect(mockClearTokens).toHaveBeenCalled();
      expect(mockDisconnectAll).toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('subscribes once per authenticated session and refreshes the badge for its own realtime notifications', async () => {
    mockGetUnreadCount.mockResolvedValueOnce({ unreadCount: 0 }).mockResolvedValue({ unreadCount: 2 });
    render(
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>,
    );
    await waitFor(() => expect(mockSubscribeToNotifications).toHaveBeenCalledTimes(1));

    const notification: AppNotification = {
      id: 14,
      recipientId: user.id,
      type: 'NEW_MESSAGE',
      title: 'New message',
      message: 'Rowan sent you a new message.',
      referenceType: 'MESSAGE',
      referenceId: 20,
      conversationId: 30,
      read: false,
      createdAt: '2026-10-06T12:00:00Z',
      readAt: null,
    };
    const handlers = mockNotificationSocket.handlers as {
      onNotification: (item: AppNotification) => void;
    };
    await act(async () => handlers.onNotification(notification));

    await waitFor(() => expect(screen.getByText('Notifications (2)')).toBeTruthy());
    expect(mockSubscribeToNotifications).toHaveBeenCalledWith('active-token', expect.any(Object));
    expect(mockGetUnreadCount).toHaveBeenCalledTimes(2);
  });
});
