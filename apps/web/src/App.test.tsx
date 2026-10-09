import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { ApiError } from './api/client';
import { getCurrentUser, login, register } from './api/auth';
import { getNearbyUsers, updateCurrentLocation } from './api/location';
import {
  getFriends,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  sendFriendRequest,
} from './api/friends';
import { getConversationDetail, getConversationPresence, getMessages, openContextualConversation, openDirectConversation } from './api/chats';
import { searchUsers, updateMyProfile } from './api/users';
import { User } from './types';

vi.mock('./api/auth', () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}));
vi.mock('./api/location', () => ({
  getNearbyUsers: vi.fn(),
  updateCurrentLocation: vi.fn(),
}));
vi.mock('./api/friends', () => ({
  getFriends: vi.fn(),
  getIncomingFriendRequests: vi.fn(),
  getOutgoingFriendRequests: vi.fn(),
  sendFriendRequest: vi.fn(),
}));
vi.mock('./api/chats', () => ({
  getConversations: vi.fn(),
  getConversationDetail: vi.fn(),
  getConversationPresence: vi.fn(),
  getMessages: vi.fn(),
  openDirectConversation: vi.fn(),
  openContextualConversation: vi.fn(),
  sendMessage: vi.fn(),
}));
vi.mock('./services/chatWebSocket', () => ({
  subscribeToConversation: vi.fn(() => vi.fn()),
  subscribeToPresence: vi.fn(() => vi.fn()),
  subscribeToGroupEvents: vi.fn(() => vi.fn()),
  subscribeToNotifications: vi.fn(() => vi.fn()),
  disconnectAllChatWebSockets: vi.fn(),
}));
vi.mock('./api/notifications', () => ({
  getNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn().mockResolvedValue({ unreadCount: 0 }),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));
vi.mock('./api/users', () => ({ searchUsers: vi.fn(), updateMyProfile: vi.fn() }));

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockLogin = vi.mocked(login);
const mockRegister = vi.mocked(register);
const mockGetNearbyUsers = vi.mocked(getNearbyUsers);
const mockUpdateLocation = vi.mocked(updateCurrentLocation);
const mockGetFriends = vi.mocked(getFriends);
const mockGetIncoming = vi.mocked(getIncomingFriendRequests);
const mockGetOutgoing = vi.mocked(getOutgoingFriendRequests);
const mockSendFriendRequest = vi.mocked(sendFriendRequest);
const mockGetConversationDetail = vi.mocked(getConversationDetail);
const mockGetConversationPresence = vi.mocked(getConversationPresence);
const mockGetMessages = vi.mocked(getMessages);
const mockOpenDirectConversation = vi.mocked(openDirectConversation);
const mockOpenContextualConversation = vi.mocked(openContextualConversation);
const mockSearchUsers = vi.mocked(searchUsers);
const mockUpdateMyProfile = vi.mocked(updateMyProfile);

const currentUser: User = {
  id: 9,
  username: 'mira',
  displayName: 'Mira Vale',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function setPath(path: string) {
  window.history.replaceState({}, '', path);
}

async function renderSignedIn(path = '/') {
  localStorage.setItem('geochat.web.accessToken', 'session-token');
  mockGetCurrentUser.mockResolvedValue(currentUser);
  setPath(path);
  render(<App />);
  await screen.findByRole('heading', { name: /welcome, mira vale/i });
}

async function renderSignedInAt(path: string, heading: string) {
  localStorage.setItem('geochat.web.accessToken', 'session-token');
  mockGetCurrentUser.mockResolvedValue(currentUser);
  setPath(path);
  render(<App />);
  await screen.findByRole('heading', { name: heading });
}

describe('web authentication and protected routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConversationPresence.mockResolvedValue({ items: [{ userId: 3, online: false }] });
    mockGetCurrentUser.mockResolvedValue(currentUser);
    setPath('/');
  });

  it('redirects an unauthenticated protected route to sign in', async () => {
    setPath('/app/search');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Search people' })).toBeNull();
  });

  it.each(['/app/profile', '/app/settings'])('protects the account route %s', async (path) => {
    setPath(path);
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
  });

  it('restores a stored session and renders the authenticated home', async () => {
    await renderSignedIn('/app/home');

    expect(mockGetCurrentUser).toHaveBeenCalledWith('session-token');
    expect(screen.getAllByText('@mira').length).toBeGreaterThan(0);
  });

  it('clears an invalid restored session and returns to sign in', async () => {
    localStorage.setItem('geochat.web.accessToken', 'expired-token');
    mockGetCurrentUser.mockRejectedValue(new ApiError('Session expired.', 401));
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(localStorage.getItem('geochat.web.accessToken')).toBeNull();
  });

  it('preserves a saved token after a temporary restoration network failure', async () => {
    localStorage.setItem('geochat.web.accessToken', 'offline-session');
    mockGetCurrentUser.mockRejectedValue(new ApiError('Unable to connect.'));
    render(<App />);

    expect((await screen.findByRole('status')).textContent).toContain('Your saved session could not be checked.');
    expect(localStorage.getItem('geochat.web.accessToken')).toBe('offline-session');
  });

  it('retries restoring a saved session after the API becomes available', async () => {
    localStorage.setItem('geochat.web.accessToken', 'offline-session');
    mockGetCurrentUser.mockRejectedValueOnce(new ApiError('Unable to connect.'));
    mockGetCurrentUser.mockResolvedValueOnce(currentUser);
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Retry session check' }));

    expect(await screen.findByRole('heading', { name: /welcome, mira vale/i })).toBeTruthy();
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('geochat.web.accessToken')).toBe('offline-session');
  });

  it('logs in with backend credentials and navigates to Home', async () => {
    mockLogin.mockResolvedValue({ token: 'new-session', tokenType: 'Bearer' });
    mockGetCurrentUser.mockResolvedValue(currentUser);
    render(<App />);

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'mira' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: /welcome, mira vale/i })).toBeTruthy();
    expect(mockLogin).toHaveBeenCalledWith({ username: 'mira', password: 'secret-password' });
    expect(localStorage.getItem('geochat.web.accessToken')).toBe('new-session');
  });

  it('shows backend login errors without storing a token', async () => {
    mockLogin.mockRejectedValue(new ApiError('Invalid username or password.', 401));
    render(<App />);

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'mira' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Invalid username or password.');
    expect(localStorage.getItem('geochat.web.accessToken')).toBeNull();
  });

  it('validates registration locally and does not auto-login after registration', async () => {
    setPath('/register');
    render(<App />);

    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Mira Vale' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'mv' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-enough-password' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'long-enough-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Username must be between 3 and 50 characters.');
    expect(mockRegister).not.toHaveBeenCalled();
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it('creates an account and returns to Login without authenticating', async () => {
    mockRegister.mockResolvedValue(currentUser);
    setPath('/register');
    render(<App />);

    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Mira Vale' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'mira' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-enough-password' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'long-enough-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Account created. Sign in to continue.');
    expect(mockRegister).toHaveBeenCalledWith({
      username: 'mira',
      displayName: 'Mira Vale',
      password: 'long-enough-password',
    });
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it('logs out and clears the stored token', async () => {
    await renderSignedIn('/app/home');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(localStorage.getItem('geochat.web.accessToken')).toBeNull();
  });

  it('updates the supported display name and synchronizes the authenticated user state', async () => {
    const updatedUser = { ...currentUser, displayName: 'Mira Updated' };
    mockUpdateMyProfile.mockResolvedValue(updatedUser);
    await renderSignedInAt('/app/profile', 'Profile');

    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: '  Mira Updated  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect((await screen.findByRole('status')).textContent).toBe('Profile updated.');
    expect(mockUpdateMyProfile).toHaveBeenCalledWith({ displayName: 'Mira Updated' }, 'session-token');
    expect(screen.getByText('Mira Updated')).toBeTruthy();
  });

  it('validates supported profile fields and presents backend errors', async () => {
    await renderSignedInAt('/app/profile', 'Profile');
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect((await screen.findByRole('alert')).textContent).toContain('between 2 and 100 characters');
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();

    mockUpdateMyProfile.mockRejectedValue(new ApiError('Display name is already invalid.', 400));
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Mira Vale' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Display name is already invalid.');
  });

  it('shows only supported settings and reuses logout cleanup', async () => {
    await renderSignedInAt('/app/settings', 'Settings');

    expect(screen.getByRole('link', { name: /Update your public display name/ })).toBeTruthy();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign out' }).at(-1)!);

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(localStorage.getItem('geochat.web.accessToken')).toBeNull();
  });
});

describe('user search', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submits the query and renders public user fields', async () => {
    mockSearchUsers.mockResolvedValue({ items: [{ userId: 12, username: 'rowan', displayName: 'Rowan Park', relationship: 'NONE' }] });
    await renderSignedIn();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: /search people/i }));
    fireEvent.change(screen.getByLabelText('Username or display name'), { target: { value: 'rowan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Rowan Park')).toBeTruthy();
    expect(screen.getByText('@rowan')).toBeTruthy();
    expect(mockSearchUsers).toHaveBeenCalledWith('rowan', 'session-token');
  });

  it('requires two characters before searching', async () => {
    await renderSignedIn();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: /search people/i }));
    fireEvent.change(screen.getByLabelText('Username or display name'), { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Enter at least 2 characters to search.');
    expect(mockSearchUsers).not.toHaveBeenCalled();
  });

  it('renders empty search results and an API error', async () => {
    mockSearchUsers.mockResolvedValueOnce({ items: [] });
    await renderSignedIn();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: /search people/i }));
    fireEvent.change(screen.getByLabelText('Username or display name'), { target: { value: 'nobody' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('No users found. Try another name.')).toBeTruthy();

    mockSearchUsers.mockRejectedValueOnce(new ApiError('Search unavailable.', 500));
    fireEvent.change(screen.getByLabelText('Username or display name'), { target: { value: 'person' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Search unavailable.');
  });
});

describe('nearby location flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFriends.mockResolvedValue({ items: [] });
    mockGetIncoming.mockResolvedValue({ items: [] });
    mockGetOutgoing.mockResolvedValue({ items: [] });
    mockSendFriendRequest.mockResolvedValue({ requestId: 81, senderId: 9, receiverId: 3, status: 'PENDING', createdAt: '', updatedAt: '' });
    mockOpenDirectConversation.mockResolvedValue({ conversationId: 41, type: 'DIRECT', participant: { userId: 3, username: 'kai', displayName: 'Kai' } });
    mockOpenContextualConversation.mockResolvedValue({ conversationId: 41, type: 'DIRECT', participant: { userId: 3, username: 'kai', displayName: 'Kai' } });
    mockGetConversationPresence.mockResolvedValue({ items: [{ userId: 3, online: false }] });
    mockGetConversationDetail.mockResolvedValue({ conversationId: 41, type: 'DIRECT', participants: [currentUser, { userId: 3, username: 'kai', displayName: 'Kai' }], createdAt: '', updatedAt: '' });
    mockGetMessages.mockResolvedValue({ items: [], total: 0, page: 0, size: 20 });
  });

  it('syncs a one-time browser location before requesting nearby users', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: vi.fn((success: PositionCallback) => success({
        coords: { latitude: 41.2, longitude: -72.8 },
      } as GeolocationPosition)) },
    });
    mockUpdateLocation.mockResolvedValue(undefined);
    mockGetNearbyUsers.mockResolvedValue({ items: [{ userId: 3, displayName: 'Kai', distanceMeters: 1250 }], radiusMeters: 5000 });
    await renderSignedIn();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: /nearby/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));

    expect(await screen.findByText('1.3 km away')).toBeTruthy();
    expect(mockUpdateLocation).toHaveBeenCalledWith({ latitude: 41.2, longitude: -72.8 }, 'session-token');
    expect(mockGetNearbyUsers).toHaveBeenCalledWith(5000, 'session-token');
    expect(screen.queryByText(/41\.2|-72\.8/)).toBeNull();
  });

  it('shows a helpful message when browser location permission is denied', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: vi.fn((_success: PositionCallback, failure: PositionErrorCallback) => failure({
        code: 1,
        message: 'denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError)) },
    });
    await renderSignedIn();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: /nearby/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Location permission is required to find nearby users.');
    expect(mockUpdateLocation).not.toHaveBeenCalled();
  });

  it('handles a browser without geolocation support', async () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    await renderSignedIn();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: /nearby/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));

    expect((await screen.findByRole('alert')).textContent).toContain('This browser does not support location access.');
  });

  it('shows empty nearby results and backend errors', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: vi.fn((success: PositionCallback) => success({
        coords: { latitude: 41.2, longitude: -72.8 },
      } as GeolocationPosition)) },
    });
    mockUpdateLocation.mockResolvedValue(undefined);
    mockGetNearbyUsers.mockResolvedValueOnce({ items: [], radiusMeters: 5000 })
      .mockRejectedValueOnce(new ApiError('Nearby search unavailable.', 500));
    await renderSignedIn();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: /nearby/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(await screen.findByText('No nearby users found in this radius.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh nearby' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Nearby search unavailable.');
  });

  it('sends a friend request to a nearby person', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: vi.fn((success: PositionCallback) => success({
        coords: { latitude: 41.2, longitude: -72.8 },
      } as GeolocationPosition)) },
    });
    mockUpdateLocation.mockResolvedValue(undefined);
    mockGetNearbyUsers.mockResolvedValue({ items: [{ userId: 3, displayName: 'Kai', distanceMeters: 600 }], radiusMeters: 5000 });
    await renderSignedIn();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: /nearby/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Add friend' }));

    expect(mockSendFriendRequest).toHaveBeenCalledWith(3, 'session-token');
    expect(await screen.findByText('Friend request sent to Kai.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Request sent · manage' })).toBeTruthy();
  });

  it('opens a direct conversation for a nearby friend', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: vi.fn((success: PositionCallback) => success({
        coords: { latitude: 41.2, longitude: -72.8 },
      } as GeolocationPosition)) },
    });
    mockUpdateLocation.mockResolvedValue(undefined);
    mockGetNearbyUsers.mockResolvedValue({ items: [{ userId: 3, displayName: 'Kai', distanceMeters: 600 }], radiusMeters: 5000 });
    mockGetFriends.mockResolvedValue({ items: [{ userId: 3, username: 'kai', displayName: 'Kai' }] });
    await renderSignedIn();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: /nearby/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Chat' }));

    expect(mockOpenDirectConversation).toHaveBeenCalledWith(3, 'session-token');
    expect(await screen.findByLabelText('Message')).toBeTruthy();
  });

  it('opens a limited chat with a nearby non-friend without requiring a friend request', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: vi.fn((success: PositionCallback) => success({
        coords: { latitude: 41.2, longitude: -72.8 },
      } as GeolocationPosition)) },
    });
    mockUpdateLocation.mockResolvedValue(undefined);
    mockGetNearbyUsers.mockResolvedValue({ items: [{ userId: 3, displayName: 'Kai', distanceMeters: 600 }], radiusMeters: 5000 });
    mockGetConversationDetail.mockResolvedValue({
      conversationId: 41, type: 'DIRECT',
      participants: [currentUser, { userId: 3, username: 'kai', displayName: 'Kai' }],
      createdAt: '', updatedAt: '', limitedMessagesRemaining: 5,
    });
    await renderSignedIn();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: /nearby/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Message' }));

    expect(mockOpenContextualConversation).toHaveBeenCalledWith(3, 5000, 'session-token');
    expect(mockSendFriendRequest).not.toHaveBeenCalled();
    expect(await screen.findByText('5 of 5 messages remaining.')).toBeTruthy();
    expect(await screen.findByLabelText('Message')).toBeTruthy();
  });
});