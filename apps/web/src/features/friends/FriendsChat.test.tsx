import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { getCurrentUser } from '../../api/auth';
import { ApiError } from '../../api/client';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  getFriends,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  rejectFriendRequest,
  sendFriendRequest,
} from '../../api/friends';
import {
  getConversationDetail,
  getConversations,
  getMessages,
  openDirectConversation,
  sendMessage,
} from '../../api/chats';
import { disconnectAllChatWebSockets } from '../../services/chatWebSocket';
import { ChatMessage, User } from '../../types';

type TestSocketHandlers = {
  onMessage: (message: ChatMessage) => void;
  onStateChange: (state: 'connecting' | 'connected' | 'reconnecting') => void;
};

const socketHarness = vi.hoisted(() => ({
  handlers: null as unknown,
  disconnect: vi.fn(),
}));

vi.mock('../../api/auth', () => ({ getCurrentUser: vi.fn() }));
vi.mock('../../api/users', () => ({ searchUsers: vi.fn() }));
vi.mock('../../api/location', () => ({ getNearbyUsers: vi.fn(), updateCurrentLocation: vi.fn() }));
vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn().mockResolvedValue({ unreadCount: 0 }),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));
vi.mock('../../api/friends', () => ({
  getFriends: vi.fn(),
  getIncomingFriendRequests: vi.fn(),
  getOutgoingFriendRequests: vi.fn(),
  sendFriendRequest: vi.fn(),
  acceptFriendRequest: vi.fn(),
  rejectFriendRequest: vi.fn(),
  cancelFriendRequest: vi.fn(),
}));
vi.mock('../../api/chats', () => ({
  getConversations: vi.fn(),
  getConversationDetail: vi.fn(),
  getMessages: vi.fn(),
  openDirectConversation: vi.fn(),
  sendMessage: vi.fn(),
}));
vi.mock('../../services/chatWebSocket', () => ({
  subscribeToConversation: vi.fn((_id: number, _token: string, handlers: unknown) => {
    socketHarness.handlers = handlers;
    return socketHarness.disconnect;
  }),
  subscribeToNotifications: vi.fn(() => socketHarness.disconnect),
  disconnectAllChatWebSockets: vi.fn(),
}));

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockGetFriends = vi.mocked(getFriends);
const mockGetIncoming = vi.mocked(getIncomingFriendRequests);
const mockGetOutgoing = vi.mocked(getOutgoingFriendRequests);
const mockSendFriendRequest = vi.mocked(sendFriendRequest);
const mockAcceptFriendRequest = vi.mocked(acceptFriendRequest);
const mockRejectFriendRequest = vi.mocked(rejectFriendRequest);
const mockCancelFriendRequest = vi.mocked(cancelFriendRequest);
const mockGetConversations = vi.mocked(getConversations);
const mockGetConversationDetail = vi.mocked(getConversationDetail);
const mockGetMessages = vi.mocked(getMessages);
const mockOpenConversation = vi.mocked(openDirectConversation);
const mockSendMessage = vi.mocked(sendMessage);
const mockDisconnectAll = vi.mocked(disconnectAllChatWebSockets);

const user: User = {
  id: 9,
  username: 'mira',
  displayName: 'Mira Vale',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const rowan = { userId: 22, username: 'rowan', displayName: 'Rowan Park' };
const request = { requestId: 71, user: rowan, createdAt: '2026-10-06T12:00:00Z' };
const savedMessage: ChatMessage = {
  messageId: 501,
  conversationId: 41,
  senderId: 9,
  content: 'Hello once',
  createdAt: '2026-10-06T12:15:00Z',
};

function setPath(path: string) {
  window.history.replaceState({}, '', path);
}

async function renderSignedIn(path: string) {
  localStorage.setItem('geochat.web.accessToken', 'session-token');
  mockGetCurrentUser.mockResolvedValue(user);
  setPath(path);
  render(<App />);
  await screen.findByRole('heading', { name: /welcome, mira vale/i }).catch(() => undefined);
}

describe('web friends and direct chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setPath('/app/home');
    socketHarness.handlers = null;
    mockGetCurrentUser.mockResolvedValue(user);
    mockGetFriends.mockResolvedValue({ items: [] });
    mockGetIncoming.mockResolvedValue({ items: [] });
    mockGetOutgoing.mockResolvedValue({ items: [] });
    mockGetConversations.mockResolvedValue({ items: [] });
    mockGetConversationDetail.mockResolvedValue({
      conversationId: 41,
      type: 'DIRECT',
      participants: [{ userId: user.id, username: user.username, displayName: user.displayName }, rowan],
      createdAt: '2026-10-06T12:00:00Z',
      updatedAt: '2026-10-06T12:00:00Z',
    });
    mockGetMessages.mockResolvedValue({ items: [], total: 0, page: 0, size: 20 });
    mockOpenConversation.mockResolvedValue({ conversationId: 41, type: 'DIRECT', participant: rowan });
    mockSendFriendRequest.mockResolvedValue({ requestId: 72, senderId: 9, receiverId: 22, status: 'PENDING', createdAt: '', updatedAt: '' });
    mockAcceptFriendRequest.mockResolvedValue({ requestId: 71, senderId: 22, receiverId: 9, status: 'ACCEPTED', createdAt: '', updatedAt: '' });
    mockRejectFriendRequest.mockResolvedValue({ requestId: 71, senderId: 22, receiverId: 9, status: 'REJECTED', createdAt: '', updatedAt: '' });
    mockCancelFriendRequest.mockResolvedValue({ requestId: 72, senderId: 9, receiverId: 22, status: 'CANCELLED', createdAt: '', updatedAt: '' });
  });

  it('accepts an incoming request, updates Friends, opens a direct chat and disconnects on logout', async () => {
    mockGetIncoming.mockResolvedValue({ items: [request] });
    await renderSignedIn('/app/friends?tab=incoming');

    expect(await screen.findByText('Rowan Park')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(mockAcceptFriendRequest).toHaveBeenCalledWith(71, 'session-token');
    expect(await screen.findByText('No incoming requests.')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Friends/ }));
    expect(await screen.findByText('@rowan')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(await screen.findByLabelText('Message')).toBeTruthy();
    expect(mockOpenConversation).toHaveBeenCalledWith(22, 'session-token');
    await waitFor(() => expect(mockGetConversationDetail).toHaveBeenCalledWith(41, 'session-token'));
    await waitFor(() => expect(mockGetMessages).toHaveBeenCalledWith(41, 0, 20, 'session-token'));
    expect(await screen.findByText('@rowan')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(mockDisconnectAll).toHaveBeenCalledOnce();
  });

  it('rejects incoming and cancels outgoing requests without reloading the page', async () => {
    mockGetIncoming.mockResolvedValue({ items: [request] });
    mockGetOutgoing.mockResolvedValue({ items: [{ ...request, requestId: 72 }] });
    await renderSignedIn('/app/friends?tab=incoming');

    await screen.findByText('Rowan Park');
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(mockRejectFriendRequest).toHaveBeenCalledWith(71, 'session-token');
    expect(await screen.findByText('No incoming requests.')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Sent/ }));
    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockCancelFriendRequest).toHaveBeenCalledWith(72, 'session-token');
    expect(await screen.findByText('No outgoing requests.')).toBeTruthy();
  });

  it('sends a friend request from Search and routes incoming/outgoing relationship states to the right list', async () => {
    const people = [
      { ...rowan, relationship: 'NONE' as const },
      { userId: 23, username: 'alba', displayName: 'Alba', relationship: 'PENDING_INCOMING' as const },
      { userId: 24, username: 'noah', displayName: 'Noah', relationship: 'PENDING_OUTGOING' as const },
      { userId: 25, username: 'sam', displayName: 'Sam', relationship: 'FRIENDS' as const },
    ];
    const { searchUsers } = await import('../../api/users');
    vi.mocked(searchUsers).mockResolvedValue({ items: people });
    mockGetIncoming.mockResolvedValue({ items: [{ ...request, requestId: 80, user: people[1] }] });
    mockGetOutgoing.mockResolvedValue({ items: [{ ...request, requestId: 81, user: people[2] }] });
    await renderSignedIn('/app/home');
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: /Search people/ }));
    fireEvent.change(screen.getByLabelText('Username or display name'), { target: { value: 'people' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByRole('button', { name: 'Add friend' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add friend' }));
    expect(mockSendFriendRequest).toHaveBeenCalledWith(22, 'session-token');
    expect(await screen.findByRole('button', { name: 'Request sent · manage' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Review request' }));
    expect((await screen.findByRole('tab', { name: /Incoming/ })).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: /Search people/ }));
    fireEvent.change(screen.getByLabelText('Username or display name'), { target: { value: 'people' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByRole('button', { name: 'Request sent · manage' });
    fireEvent.click(screen.getByRole('button', { name: 'Request sent · manage' }));
    expect((await screen.findByRole('tab', { name: /Sent/ })).getAttribute('aria-selected')).toBe('true');
  });

  it('loads a conversation list and merges REST sends with duplicate STOMP frames once', async () => {
    mockGetConversations.mockResolvedValue({ items: [{
      conversationId: 41,
      type: 'DIRECT',
      participant: rowan,
      updatedAt: '2026-10-06T12:00:00Z',
      lastMessage: 'Earlier note',
    }] });
    mockSendMessage.mockResolvedValue(savedMessage);
    await renderSignedIn('/app/chat');

    expect(await screen.findByText('Earlier note')).toBeTruthy();
    fireEvent.click(await screen.findByRole('link', { name: /Rowan Park/ }));
    const composer = await screen.findByLabelText('Message');
    expect(mockGetConversations).toHaveBeenCalledWith('session-token');
    fireEvent.change(composer, { target: { value: 'Hello once' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Hello once')).toBeTruthy();
    expect(mockSendMessage).toHaveBeenCalledWith(41, { content: 'Hello once' }, 'session-token');
    const handlers = socketHarness.handlers as TestSocketHandlers | null;
    expect(handlers).not.toBeNull();
    await act(async () => handlers?.onMessage(savedMessage));
    expect(screen.getAllByText('Hello once')).toHaveLength(1);
  });

  it('loads older pages without losing the latest history', async () => {
    mockGetConversations.mockResolvedValue({ items: [{ conversationId: 41, type: 'DIRECT', participant: rowan, updatedAt: '', lastMessage: null }] });
    const latest: ChatMessage = { ...savedMessage, messageId: 510, content: 'Latest page', createdAt: '2026-10-06T12:10:00Z' };
    const older: ChatMessage = { ...savedMessage, messageId: 490, content: 'Older page', createdAt: '2026-10-06T11:10:00Z' };
    mockGetMessages.mockResolvedValueOnce({ items: [latest], total: 21, page: 0, size: 20 })
      .mockResolvedValueOnce({ items: [older], total: 21, page: 1, size: 20 });
    await renderSignedIn('/app/chat');
    fireEvent.click(await screen.findByRole('link', { name: /Rowan Park/ }));

    expect(await screen.findByText('Latest page')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Load older messages' }));
    expect(await screen.findByText('Older page')).toBeTruthy();
    expect(screen.getByText('Latest page')).toBeTruthy();
    expect(mockGetMessages).toHaveBeenNthCalledWith(2, 41, 1, 20, 'session-token');
  });

  it('shows an empty conversation-list state', async () => {
    await renderSignedIn('/app/chat');
    expect(await screen.findByText(/No conversations yet/)).toBeTruthy();
  });

  it('shows conversation-list errors', async () => {
    mockGetConversations.mockRejectedValueOnce(new ApiError('Unable to load conversations right now.'));
    await renderSignedIn('/app/chat');
    expect((await screen.findByRole('alert')).textContent).toContain('Unable to load conversations right now.');
  });

  it('shows an empty message-history state', async () => {
    await renderSignedIn('/app/chat/41');
    expect(await screen.findByText('No messages yet. Start the conversation.')).toBeTruthy();
  });

  it('shows message-history errors without a composer', async () => {
    mockGetMessages.mockRejectedValueOnce(new ApiError('Unable to load this conversation.'));
    await renderSignedIn('/app/chat/41');
    expect((await screen.findByRole('alert')).textContent).toContain('Unable to load this conversation.');
    expect(screen.queryByLabelText('Message')).toBeNull();
  });
});