import React from 'react';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { getMyProfile, updateMyProfile } from '../api/userApi';
import { User } from '../types/auth';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/userApi', () => ({
  getMyProfile: jest.fn(),
  updateMyProfile: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGetMyProfile = getMyProfile as jest.MockedFunction<typeof getMyProfile>;
const mockUpdateMyProfile = updateMyProfile as jest.MockedFunction<typeof updateMyProfile>;

const currentUser: User = {
  id: 1,
  username: 'geochat-user',
  displayName: 'Geo Chat User',
  status: 'ACTIVE',
  createdAt: '2025-03-10T12:00:00Z',
  updatedAt: '2025-03-10T12:00:00Z',
};
const token = 'profile-token';
const mockUpdateUser = jest.fn();
const mockLogout = jest.fn().mockResolvedValue(undefined);

function setupAuth(user: User | null = currentUser, accessToken: string | null = token) {
  mockUseAuth.mockReturnValue({
    user,
    token: accessToken,
    updateUser: mockUpdateUser,
  } as unknown as ReturnType<typeof useAuth>);
}

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuth();
    mockGetMyProfile.mockResolvedValue(currentUser);
  });

  it('loads the server profile and shows only supported public fields', async () => {
    const onEditProfile = jest.fn();
    const onOpenSettings = jest.fn();
    render(
      <ProfileScreen
        onBack={jest.fn()}
        onEditProfile={onEditProfile}
        onOpenSettings={onOpenSettings}
      />,
    );

    await waitFor(() => {
      expect(mockGetMyProfile).toHaveBeenCalledWith(token);
      expect(mockUpdateUser).toHaveBeenCalledWith(currentUser);
      expect(screen.getByText('Geo Chat User')).toBeTruthy();
    });
    expect(screen.getByText('@geochat-user')).toBeTruthy();
    expect(screen.getByText('Username')).toBeTruthy();
    expect(screen.getByText(/2025/)).toBeTruthy();
    expect(screen.queryByText(/password|email/i)).toBeNull();

    fireEvent.press(screen.getByText('Edit profile'));
    fireEvent.press(screen.getByText('Settings'));
    expect(onEditProfile).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('shows loading while fetching the current profile', () => {
    mockGetMyProfile.mockReturnValue(new Promise(() => undefined));
    render(<ProfileScreen onBack={jest.fn()} onEditProfile={jest.fn()} onOpenSettings={jest.fn()} />);

    expect(screen.getByText('Profile')).toBeTruthy();
    expect(screen.getByText('Loading profile...')).toBeTruthy();
  });

  it('shows a retryable error when profile loading fails', async () => {
    mockGetMyProfile.mockRejectedValue(new ApiError('Unable to connect.', 'network'));
    render(<ProfileScreen onBack={jest.fn()} onEditProfile={jest.fn()} onOpenSettings={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Unable to connect.')).toBeTruthy());
    expect(screen.getByText('Retry')).toBeTruthy();
  });
});

describe('EditProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuth();
  });

  it('populates fields and saves the trimmed display name to shared auth state', async () => {
    const updatedUser = { ...currentUser, displayName: 'Updated Name' };
    const onSaved = jest.fn();
    mockUpdateMyProfile.mockResolvedValue(updatedUser);
    render(<EditProfileScreen onBack={jest.fn()} onSaved={onSaved} />);

    expect(screen.getByLabelText('Display name').props.value).toBe('Geo Chat User');
    expect(screen.getByLabelText('Username').props.value).toBe('geochat-user');
    expect(screen.getByLabelText('Username').props.editable).toBe(false);

    fireEvent.changeText(screen.getByLabelText('Display name'), '  Updated Name  ');
    fireEvent.press(screen.getByRole('button', { name: 'Save profile changes' }));

    await waitFor(() => {
      expect(mockUpdateMyProfile).toHaveBeenCalledWith({ displayName: 'Updated Name' }, token);
      expect(mockUpdateUser).toHaveBeenCalledWith(updatedUser);
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
  });

  it('rejects empty and out-of-range display names without calling the API', () => {
    render(<EditProfileScreen onBack={jest.fn()} onSaved={jest.fn()} />);
    const input = screen.getByLabelText('Display name');

    fireEvent.changeText(input, '   ');
    fireEvent.press(screen.getByRole('button', { name: 'Save profile changes' }));
    expect(screen.getByText('Display name is required.')).toBeTruthy();

    fireEvent.changeText(input, 'A');
    fireEvent.press(screen.getByRole('button', { name: 'Save profile changes' }));
    expect(screen.getByText('Display name must be between 2 and 100 characters.')).toBeTruthy();
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
  });

  it('handles profile update errors without updating auth state', async () => {
    mockUpdateMyProfile.mockRejectedValue(new ApiError('Please check the information and try again.', 'bad_request', 400));
    render(<EditProfileScreen onBack={jest.fn()} onSaved={jest.fn()} />);

    fireEvent.changeText(screen.getByLabelText('Display name'), 'Updated Name');
    fireEvent.press(screen.getByRole('button', { name: 'Save profile changes' }));

    await waitFor(() => expect(screen.getByText('Please check the information and try again.')).toBeTruthy());
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('prevents duplicate saves while the update is pending', async () => {
    let resolveUpdate!: (user: User) => void;
    mockUpdateMyProfile.mockReturnValue(new Promise((resolve) => { resolveUpdate = resolve; }));
    render(<EditProfileScreen onBack={jest.fn()} onSaved={jest.fn()} />);

    const saveButton = screen.getByRole('button', { name: 'Save profile changes' });
    fireEvent.press(saveButton);
    fireEvent.press(saveButton);

    expect(mockUpdateMyProfile).toHaveBeenCalledTimes(1);
    await act(async () => resolveUpdate(currentUser));
  });
});

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuth();
    mockUseAuth.mockReturnValue({
      user: currentUser,
      token,
      logout: mockLogout,
    } as unknown as ReturnType<typeof useAuth>);
  });

  it('supports profile navigation and explains unavailable password changes', () => {
    const onOpenProfile = jest.fn();
    render(<SettingsScreen onBack={jest.fn()} onOpenProfile={onOpenProfile} />);

    expect(screen.getByText('Password changes are not available yet.')).toBeTruthy();
    fireEvent.press(screen.getByText('Profile'));
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
  });

  it('uses the existing logout action', async () => {
    render(<SettingsScreen onBack={jest.fn()} onOpenProfile={jest.fn()} />);

    fireEvent.press(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
  });

  it('shows a recoverable message if secure logout fails', async () => {
    mockLogout.mockRejectedValue(new Error('storage failure'));
    render(<SettingsScreen onBack={jest.fn()} onOpenProfile={jest.fn()} />);

    fireEvent.press(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(screen.getByText('Unable to log out right now. Please try again.')).toBeTruthy());
  });
});
