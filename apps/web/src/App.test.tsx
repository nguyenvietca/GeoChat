import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { setLanguage } from './i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { ApiError } from './api/client';
import { getCurrentUser, login, register } from './api/auth';
import { getNearbyUsers, updateCurrentLocation, getDiscoverability, setDiscoverability } from './api/location';
import {
  getFriends,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  getFriendRelationship,
} from './api/friends';
import { getConversations, openDiscoveryConversation, getConversationDetail, getConversationPresence, getMessages, openContextualConversation, openDirectConversation } from './api/chats';
import { searchUsers, updateMyProfile, getPublicProfile } from './api/users';
import { User } from './types';

vi.mock('./api/auth', () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  registrationConfig: vi.fn().mockResolvedValue({ enabled: false, siteKey: null }),
}));
vi.mock('./api/google', () => ({
  googleConfig: vi.fn().mockResolvedValue({ enabled: false }),
  googleConnections: vi.fn().mockResolvedValue({ passwordAvailable: true, googleConnected: false, email: null }),
  cancelGoogle: vi.fn().mockResolvedValue(null),
  completeGoogle: vi.fn(),
  startGoogle: vi.fn(),
  unlinkGoogle: vi.fn(),
}));
vi.mock('./features/nearby/NearbyMap',()=>({NearbyMap:({people,onSelect}:{people:{userId:number}[];onSelect:(id:number)=>void})=> <div aria-label="Nearby map">{people[0]?<button onClick={()=>onSelect(people[0].userId)}>Select area</button>:null}</div>}));
vi.mock('./api/location', () => ({
  getDiscoverability: vi.fn().mockResolvedValue({discoverable:false}),
  setDiscoverability: vi.fn().mockResolvedValue({discoverable:true}),
  getNearbyUsers: vi.fn(),
  updateCurrentLocation: vi.fn(),
}));
vi.mock('./api/friends', () => ({
  acceptFriendRequest: vi.fn(),
  cancelFriendRequest: vi.fn(),
  rejectFriendRequest: vi.fn(),
  removeFriend: vi.fn(),
  getFriendRelationship: vi.fn().mockResolvedValue({ userId: 3, relationship: 'NONE', requestId: null }),
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
  openDiscoveryConversation: vi.fn(),
  openContextualConversation: vi.fn(),
  sendMessage: vi.fn(),
}));
vi.mock('./services/chatWebSocket', () => ({
  subscribeToConversation: vi.fn(() => vi.fn()),
  publishTypingState: vi.fn(() => true),
  subscribeToPresence: vi.fn(() => vi.fn()),
  subscribeToConversationActivity: vi.fn(() => vi.fn()),
  subscribeToGroupEvents: vi.fn(() => vi.fn()),
  subscribeToNotifications: vi.fn(() => vi.fn()),
  subscribeToConversationRead: vi.fn(() => vi.fn()),
  disconnectAllChatWebSockets: vi.fn(),
}));
vi.mock('./api/notifications', () => ({
  getNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn().mockResolvedValue({ unreadCount: 0 }),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  getNotificationPreferences: vi.fn().mockResolvedValue({ directAlerts: true, groupAlerts: true, friendRequestAlerts: true, friendAcceptanceAlerts: true }),
  updateNotificationPreferences: vi.fn(),
}));
vi.mock('./api/users', () => ({ searchUsers: vi.fn(), updateMyProfile: vi.fn(), getPublicProfile: vi.fn() }));

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockLogin = vi.mocked(login);
const mockRegister = vi.mocked(register);
const mockGetNearbyUsers = vi.mocked(getNearbyUsers);
const mockUpdateLocation = vi.mocked(updateCurrentLocation);
const mockGetFriends = vi.mocked(getFriends);
const mockGetIncoming = vi.mocked(getIncomingFriendRequests);
const mockGetOutgoing = vi.mocked(getOutgoingFriendRequests);
const mockSendFriendRequest = vi.mocked(sendFriendRequest);
const mockGetFriendRelationship = vi.mocked(getFriendRelationship);
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
    await waitFor(() => expect((screen.getByRole('button', { name: 'Create account' }) as HTMLButtonElement).disabled).toBe(false));

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
    await waitFor(() => expect((screen.getByRole('button', { name: 'Create account' }) as HTMLButtonElement).disabled).toBe(false));

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
    expect(mockUpdateMyProfile).toHaveBeenCalledWith({ displayName: 'Mira Updated', email: null, phoneNumber: null }, 'session-token');
    expect(screen.getAllByText('Mira Updated').length).toBeGreaterThan(0);
  });

  it('shows duplicate email beside the input, focuses it and preserves the draft', async () => {
    mockUpdateMyProfile.mockRejectedValue(new ApiError('This email is already in use. Please choose a different email address.', 409));
    await renderSignedInAt('/app/profile', 'Profile');
    const email = screen.getByLabelText('Email') as HTMLInputElement;
    fireEvent.change(email, { target: { value: 'taken@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect((await screen.findByRole('alert')).textContent).toContain('This email is already in use.');
    await waitFor(() => expect(document.activeElement).toBe(email));
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(email.getAttribute('aria-describedby')).toBe('profile-email-error');
    expect(email.value).toBe('taken@example.com');
    fireEvent.change(email, { target: { value: 'different@example.com' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(email.getAttribute('aria-invalid')).toBe('false');
  });

  it('switches the sign-in action and validation message to Vietnamese', async () => {
    setPath('/login'); render(<App />);
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'vi' } });
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Vui lòng nhập tên đăng nhập và mật khẩu.');
  });

  it('updates an existing profile error on language change without losing the email draft', async () => {
    mockUpdateMyProfile.mockRejectedValue(new ApiError('This email is already in use. Please choose a different email address.', 409));
    await renderSignedInAt('/app/profile', 'Profile');
    const email = screen.getByLabelText('Email') as HTMLInputElement;
    fireEvent.change(email, { target: { value: 'taken@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('alert');
    act(() => setLanguage('vi'));
    expect(screen.getByRole('alert').textContent).toContain('Email này đã được sử dụng.');
    expect(email.value).toBe('taken@example.com');
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeTruthy();
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

  it('links profile validation to its input and cancels unsaved edits without an API request', async () => {
    await renderSignedInAt('/app/profile', 'Profile');
    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    expect(input.value).toBe(currentUser.displayName);
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Skip to content' }).getAttribute('href')).toBe('#main-content');
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

  it('opens a limited discovery chat from Search for a non-friend', async () => {
    mockSearchUsers.mockResolvedValue({ items: [{ userId: 12, username: 'rowan', displayName: 'Rowan Park', relationship: 'NONE' }] });
    vi.mocked(openDiscoveryConversation).mockResolvedValue({ conversationId: 72, type: 'DIRECT', participant: { userId: 12, username: 'rowan', displayName: 'Rowan Park' } });
    vi.mocked(getConversations).mockResolvedValue({ items: [] });
    mockGetConversationDetail.mockResolvedValue({ conversationId: 72, type: 'DIRECT', participants: [], createdAt: '', updatedAt: '', limitedMessagesRemaining: 5 });
    mockGetMessages.mockResolvedValue({ items: [], total: 0, page: 0, size: 20 });
    await renderSignedIn();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: /^Search$/ }));
    fireEvent.change(screen.getByLabelText('Username or display name'), { target: { value: 'rowan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Message' }));
    expect(await screen.findByText('5 of 5 messages remaining.')).toBeTruthy();
    expect(openDiscoveryConversation).toHaveBeenCalledWith(12, 'session-token');
    expect(mockSendFriendRequest).not.toHaveBeenCalled();
  });

  it('submits the query and renders public user fields', async () => {
    mockSearchUsers.mockResolvedValue({ items: [{ userId: 12, username: 'rowan', displayName: 'Rowan Park', relationship: 'NONE' }] });
    await renderSignedIn();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: /^search$/i }));
    fireEvent.change(screen.getByLabelText('Username or display name'), { target: { value: 'rowan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Rowan Park')).toBeTruthy();
    expect(screen.getByText('@rowan')).toBeTruthy();
    expect(mockSearchUsers).toHaveBeenCalledWith('rowan', 'session-token');
  });

  it('requires two characters before searching', async () => {
    await renderSignedIn();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: /^search$/i }));
    fireEvent.change(screen.getByLabelText('Username or display name'), { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Enter at least 2 characters to search.');
    expect(mockSearchUsers).not.toHaveBeenCalled();
  });

  it('renders empty search results and an API error', async () => {
    mockSearchUsers.mockResolvedValueOnce({ items: [] });
    await renderSignedIn();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: /^search$/i }));
    fireEvent.change(screen.getByLabelText('Username or display name'), { target: { value: 'nobody' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('No matching users. Try another name.')).toBeTruthy();

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

  it('keeps visibility separate from GPS and preserves selection across map/list switches', async () => {
    const gps=vi.fn((success:PositionCallback)=>success({coords:{latitude:41.2,longitude:-72.8}} as GeolocationPosition));
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:gps}});
    mockUpdateLocation.mockResolvedValue(undefined);
    mockGetNearbyUsers.mockResolvedValue({items:[{userId:3,displayName:'Kai',distanceMeters:0}],radiusMeters:5000});
    await renderSignedIn();fireEvent.click(within(screen.getByRole('navigation',{name:'Main navigation'})).getByRole('link',{name:/nearby/i}));
    const visibility=screen.getByRole('checkbox',{name:'Allow others to discover me nearby'});
    await waitFor(()=>expect(visibility.hasAttribute('disabled')).toBe(false));
    expect(gps).not.toHaveBeenCalled();fireEvent.click(visibility);
    await waitFor(()=>expect(setDiscoverability).toHaveBeenCalledWith(true,'session-token'));
    expect(gps).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Use my location'}));await screen.findByText('Less than 1 km');
    fireEvent.click(screen.getByRole('button',{name:'Map view'}));fireEvent.click(screen.getByRole('button',{name:'Select area'}));
    await screen.findByText(/Selected: Kai/);fireEvent.click(screen.getByRole('button',{name:'List view'}));
    expect(screen.getByRole('button',{name:/Kai Less than 1 km/}).getAttribute('aria-pressed')).toBe('true');
    expect(mockGetNearbyUsers).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('link',{name:'View profile'})[0].getAttribute('href')).toBe('/app/profile/3');
  });
  it('ignores stale radius results without requesting GPS again', async () => {
    const gps=vi.fn((success:PositionCallback)=>success({coords:{latitude:41.2,longitude:-72.8}} as GeolocationPosition));
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:gps}});
    mockUpdateLocation.mockResolvedValue(undefined);
    let finish:(value:{items:{userId:number;displayName:string;distanceMeters:number}[];radiusMeters:number})=>void=()=>{};
    mockGetNearbyUsers.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValueOnce({items:[{userId:4,displayName:'New result',distanceMeters:0}],radiusMeters:1000});
    await renderSignedIn();fireEvent.click(within(screen.getByRole('navigation',{name:'Main navigation'})).getByRole('link',{name:/nearby/i}));
    fireEvent.click(screen.getByRole('button',{name:'Use my location'}));await waitFor(()=>expect(mockGetNearbyUsers).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText('Within'),{target:{value:'1000'}});await screen.findByText('New result');
    finish({items:[{userId:3,displayName:'Old result',distanceMeters:0}],radiusMeters:5000});
    await waitFor(()=>expect(screen.queryByText('Old result')).toBeNull());expect(gps).toHaveBeenCalledTimes(1);
  });
  it('accepts a received request directly on a nearby card', async () => {
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(success:PositionCallback)=>success({coords:{latitude:41.2,longitude:-72.8}} as GeolocationPosition)}});
    mockUpdateLocation.mockResolvedValue(undefined);mockGetNearbyUsers.mockResolvedValue({items:[{userId:3,displayName:'Kai',distanceMeters:0}],radiusMeters:5000});
    mockGetIncoming.mockResolvedValue({items:[{requestId:81,user:{userId:3,username:'kai',displayName:'Kai'},createdAt:''}]});
    vi.mocked(acceptFriendRequest).mockResolvedValue({requestId:81,senderId:3,receiverId:9,status:'ACCEPTED',createdAt:'',updatedAt:''});
    await renderSignedIn();fireEvent.click(within(screen.getByRole('navigation',{name:'Main navigation'})).getByRole('link',{name:/nearby/i}));
    fireEvent.click(screen.getByRole('button',{name:'Use my location'}));await screen.findByText('Request received');
    fireEvent.click(screen.getByRole('button',{name:'Accept request'}));await screen.findByText('You and Kai are now friends.');
    expect(acceptFriendRequest).toHaveBeenCalledWith(81,'session-token');expect(screen.getByRole('button',{name:'Chat'})).toBeTruthy();
  });

  it('navigates from a nearby card to the shared public profile route', async () => {
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(success:PositionCallback)=>success({coords:{latitude:41.2,longitude:-72.8}} as GeolocationPosition)}});
    mockUpdateLocation.mockResolvedValue(undefined);mockGetNearbyUsers.mockResolvedValue({items:[{userId:3,displayName:'Kai',distanceMeters:0}],radiusMeters:5000});
    vi.mocked(getPublicProfile).mockResolvedValue({userId:3,displayName:'Kai Public',username:'kai'});
    mockGetFriendRelationship.mockResolvedValue({userId:3,relationship:'NONE',requestId:null});
    await renderSignedIn();fireEvent.click(within(screen.getByRole('navigation',{name:'Main navigation'})).getByRole('link',{name:/nearby/i}));
    fireEvent.click(screen.getByRole('button',{name:'Use my location'}));await screen.findByText('Kai');
    fireEvent.click(screen.getByRole('link',{name:'View profile'}));await screen.findByRole('heading',{name:'Public profile'});
    await screen.findByRole('heading',{name:'Kai Public'});expect(getPublicProfile).toHaveBeenCalledWith(3,'session-token');
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

    expect(await screen.findByText('About 1 km')).toBeTruthy();
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
    expect(await screen.findByText(/No nearby users found in this radius/)).toBeTruthy();

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
    expect(screen.getByRole('button', { name: 'Cancel request' })).toBeTruthy();
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

  it('opens the nearby result using its search radius even after the radius selector changes', async () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: vi.fn((success) => success({ coords: { latitude: 0, longitude: 0 } })),
    } });
    mockUpdateLocation.mockResolvedValue({ latitude: 0, longitude: 0 });
    mockGetNearbyUsers.mockResolvedValue({ items: [{ userId: 3, displayName: 'Kai', distanceMeters: 4000 }], radiusMeters: 5000 });
    mockOpenContextualConversation.mockResolvedValue({ conversationId: 41, type: 'DIRECT', participant: { userId: 3, username: 'kai', displayName: 'Kai' } });
    await renderSignedIn();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: /nearby/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));
    await screen.findByText('Kai');
    fireEvent.change(screen.getByLabelText('Within'), { target: { value: '1000' } });
    await waitFor(()=>expect(screen.getByRole('button',{name:'Message'}).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Message' }));
    await screen.findByLabelText('Message');
    expect(mockOpenContextualConversation).toHaveBeenCalledWith(3, 5000, 'session-token');
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
