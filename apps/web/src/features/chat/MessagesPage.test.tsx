import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { getCurrentUser } from '../../api/auth';
import { acceptFriendRequest, getFriends, getIncomingFriendRequests, getOutgoingFriendRequests, sendFriendRequest } from '../../api/friends';
import { getConversationDetail, getConversationPresence, getConversations, getMessages, openContextualConversation, openDirectConversation, sendMessage, markConversationRead } from '../../api/chats';
import { addGroupMembers, createGroup, deleteGroup, getGroup, getGroupMembers, leaveGroup, removeGroupMember, renameGroup } from '../../api/groups';
import { ChatMessage, ConversationDetail, GroupInfo, GroupManagementEvent, User } from '../../types';

type Handlers = { onMessage: (message: ChatMessage) => void };
type PresenceHandler = (presence: { userId: number; online: boolean }) => void;

const socket = vi.hoisted(() => ({
  handlers: new Map<number, unknown>(),
  unsubscribe: new Map<number, ReturnType<typeof vi.fn>>(),
  activityHandlers: null as unknown,
  groupEventHandlers: null as unknown,
  presenceHandlers: new Map<number, PresenceHandler>(),
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
vi.mock('../../api/friends', () => ({ getFriends: vi.fn(), sendFriendRequest: vi.fn(), acceptFriendRequest: vi.fn(),
  getIncomingFriendRequests: vi.fn().mockResolvedValue({ items: [] }), getOutgoingFriendRequests: vi.fn().mockResolvedValue({ items: [] }) }));
vi.mock('../../api/chats', () => ({
  getConversations: vi.fn(),
  getConversationDetail: vi.fn(),
  getConversationPresence: vi.fn(),
  getMessages: vi.fn(),
  openDirectConversation: vi.fn(),
  openContextualConversation: vi.fn(),
  sendMessage: vi.fn(),
  markConversationRead: vi.fn(),
}));
vi.mock('../../api/groups', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/groups')>()),
  createGroup: vi.fn(),
  deleteGroup: vi.fn(),
  getGroup: vi.fn(),
  getGroupMembers: vi.fn(),
  leaveGroup: vi.fn(),
  addGroupMembers: vi.fn(),
  removeGroupMember: vi.fn(),
  renameGroup: vi.fn(),
}));
vi.mock('../../services/chatWebSocket', () => ({
  subscribeToConversation: vi.fn((id: number, _token: string, handlers: unknown) => {
    socket.handlers.set(id, handlers);
    const unsubscribe = vi.fn();
    socket.unsubscribe.set(id, unsubscribe);
    return unsubscribe;
  }),
  subscribeToConversationActivity: vi.fn((_token: string, handlers: unknown) => { socket.activityHandlers = handlers; return vi.fn(); }),
  subscribeToGroupEvents: vi.fn((_token: string, handlers: unknown) => {
    socket.groupEventHandlers = handlers;
    return vi.fn();
  }),
  subscribeToPresence: vi.fn((userId: number, _token: string, handlers: { onPresence: PresenceHandler }) => {
    socket.presenceHandlers.set(userId, handlers.onPresence);
    return vi.fn();
  }),
  subscribeToNotifications: vi.fn(() => vi.fn()),
  disconnectAllChatWebSockets: vi.fn(),
}));

const me: User = { id: 9, username: 'mira', displayName: 'Mira Vale', status: 'ACTIVE', createdAt: '', updatedAt: '' };
const rowan = { userId: 22, username: 'rowan', displayName: 'Rowan Park' };
const mira = { userId: 9, username: 'mira', displayName: 'Mira Vale' };
const groupInfo = (ownerId: number): GroupInfo => ({
  groupId: 50, name: 'Trip crew', owner: ownerId === 9 ? mira : rowan, memberCount: 2, createdAt: '', updatedAt: '',
});
const directConversation = { conversationId: 41, type: 'DIRECT', participant: rowan, updatedAt: '2026-10-06T12:00:00Z', lastMessage: 'Earlier note' };
const groupConversation = { conversationId: 50, type: 'GROUP', participant: rowan, updatedAt: '2026-10-07T12:00:00Z', lastMessage: 'See you' };
const message = (id: number, conversationId: number, senderId: number, content: string): ChatMessage => ({
  messageId: id, conversationId, senderId, content, createdAt: `2026-10-07T12:0${id % 10}:00Z`,
});

async function openMessages(path = '/app/chat') {
  localStorage.setItem('geochat.web.accessToken', 'session-token');
  window.history.replaceState({}, '', path);
  render(<App />);
  await screen.findByRole('heading', { name: 'Messages' });
}

describe('web messages split view and group chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    socket.handlers.clear();
    socket.unsubscribe.clear();
    socket.groupEventHandlers = null;
    socket.presenceHandlers.clear();
    vi.mocked(getCurrentUser).mockResolvedValue(me);
    vi.mocked(getFriends).mockResolvedValue({ items: [rowan] });
    vi.mocked(getIncomingFriendRequests).mockResolvedValue({ items: [] });
    vi.mocked(getOutgoingFriendRequests).mockResolvedValue({ items: [] });
    vi.mocked(getConversations).mockResolvedValue({ items: [] });
    vi.mocked(getConversationDetail).mockImplementation(async (id): Promise<ConversationDetail> => ({
      conversationId: id, type: id === 50 || id === 60 ? 'GROUP' : 'DIRECT', participants: [mira, rowan], createdAt: '', updatedAt: '',
    }));
    vi.mocked(getMessages).mockResolvedValue({ items: [], total: 0, page: 0, size: 20 });
    vi.mocked(getConversationPresence).mockResolvedValue({ items: [{ userId: 22, online: false }] });
    vi.mocked(getGroup).mockResolvedValue(groupInfo(22));
    vi.mocked(getGroupMembers).mockResolvedValue({ items: [
      { user: rowan, role: 'OWNER', joinedAt: '' }, { user: mira, role: 'MEMBER', joinedAt: '' },
    ] });
    vi.mocked(openDirectConversation).mockResolvedValue({ conversationId: 41, type: 'DIRECT', participant: rowan });
  });

  it('filters direct and group names locally, trims case, clears search and preserves selection', async () => {
    vi.mocked(getConversations).mockResolvedValue({ items: [directConversation, { ...groupConversation, groupName: 'Trip crew' }] });
    await openMessages('/app/chat/41');
    await screen.findByRole('link', { name: /Earlier note/ });
    const input = screen.getByRole('searchbox', { name: 'Search conversations' });
    fireEvent.change(input, { target: { value: '  ROWAN  ' } });
    expect(screen.getByRole('link', { name: /Earlier note/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Trip crew/ })).toBeNull();
    fireEvent.change(input, { target: { value: 'trip' } });
    expect(screen.getByRole('link', { name: /Trip crew/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Earlier note/ })).toBeNull();
    fireEvent.change(input, { target: { value: 'missing' } });
    expect(screen.getByText('No conversations match your search.')).toBeTruthy();
    expect(window.location.pathname).toBe('/app/chat/41');
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getAllByRole('link', { name: /Earlier note|Trip crew/ })).toHaveLength(2);
    expect(getConversations).toHaveBeenCalledTimes(1);
    expect(getFriends).toHaveBeenCalledTimes(1);
  });

  it('orders direct and empty owner-only groups together and applies deduplicated realtime previews', async () => {
    vi.mocked(getConversations).mockResolvedValue({ items: [directConversation, {
      ...groupConversation, groupName: 'Solo group', lastMessage: null,
      lastMessageAt: null,
    }] });
    await openMessages();
    await screen.findByRole('link', { name: /Solo group/ });
    const sidebar = screen.getByRole('complementary', { name: 'Friends and conversations' });
    expect(within(sidebar).getAllByRole('link')[0].textContent).toContain('Solo group');
    expect(within(sidebar).getByText('No messages yet')).toBeTruthy();
    const handlers = socket.activityHandlers as { onActivity: (message: ChatMessage, sender: string) => void };
    const latest = { ...message(99, 41, 22, '<b>Latest note</b>'), createdAt: '2026-10-09T12:00:00Z' };
    act(() => { handlers.onActivity(latest, 'Rowan Park'); handlers.onActivity(latest, 'Rowan Park'); });
    expect(within(sidebar).getAllByRole('link')[0].textContent).toContain('<b>Latest note</b>');
    expect(within(sidebar).getAllByText('<b>Latest note</b>')).toHaveLength(1);
    expect(sidebar.querySelector('b')).toBeNull();
    act(() => handlers.onActivity({ ...message(100, 50, 22, 'Group note'), createdAt: '2026-10-10T12:00:00Z' }, 'Rowan Park'));
    expect(within(sidebar).getAllByRole('link')[0].textContent).toContain('Rowan Park: Group note');
    expect(getConversations).toHaveBeenCalledTimes(1);
    expect(getGroup).not.toHaveBeenCalled();
  });

  it('guards pending sends, preserves a failed draft and supports an explicit retry with REST/socket deduplication', async () => {
    vi.mocked(getConversations).mockResolvedValue({ items: [directConversation] });
    let rejectSend!: (error: Error) => void;
    vi.mocked(sendMessage).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSend = reject; }));
    await openMessages('/app/chat/41');
    const input = await screen.findByLabelText('Message');
    await waitFor(() => expect(input.hasAttribute('disabled')).toBe(false));
    fireEvent.change(input, { target: { value: 'Retry draft' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('button', { name: /Sending/ }).hasAttribute('disabled')).toBe(true);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    await act(async () => rejectSend(new Error('Network lost')));
    expect((input as HTMLTextAreaElement).value).toBe('Retry draft');
    expect(screen.getByRole('alert').textContent).toContain('server may have saved it');
    fireEvent.click(screen.getByRole('button', { name: 'Check recent messages' }));
    await waitFor(() => expect(getMessages).toHaveBeenCalledTimes(2));
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect((input as HTMLTextAreaElement).value).toBe('Retry draft');
    const saved = message(8, 41, 9, 'Retry draft');
    vi.mocked(sendMessage).mockResolvedValueOnce(saved);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect((input as HTMLTextAreaElement).value).toBe(''));
    act(() => (socket.handlers.get(41) as Handlers).onMessage(saved));
    expect(document.querySelectorAll('.chat-bubble p')).toHaveLength(1);
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(getConversations).toHaveBeenCalledTimes(1);
  });

  it('scrolls near the bottom, preserves older reading position and offers jump to latest', async () => {
    vi.mocked(getConversations).mockResolvedValue({ items: [directConversation] });
    await openMessages('/app/chat/41');
    await waitFor(() => expect(screen.getByLabelText('Message').hasAttribute('disabled')).toBe(false));
    const area = document.querySelector('.chat-message-area') as HTMLDivElement;
    Object.defineProperties(area, { scrollHeight: { configurable: true, value: 1000 }, clientHeight: { value: 200 } });
    const scrollTo = vi.fn();
    area.scrollTo = scrollTo;
    area.scrollTop = 800;
    fireEvent.scroll(area);
    act(() => (socket.handlers.get(41) as Handlers).onMessage(message(3, 41, 22, 'Near bottom')));
    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
    scrollTo.mockClear();
    area.scrollTop = 100;
    fireEvent.scroll(area);
    act(() => (socket.handlers.get(41) as Handlers).onMessage(message(4, 41, 22, 'Reading older')));
    expect(area.scrollTop).toBe(100);
    expect(scrollTo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Jump to latest' }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
  });

  it('keeps the visible position when prepending older history', async () => {
    vi.mocked(getMessages).mockResolvedValueOnce({ items: [message(20, 41, 22, 'Newest')], total: 21, page: 0, size: 20 });
    await openMessages('/app/chat/41');
    await screen.findByText('Newest');
    const area = document.querySelector('.chat-message-area') as HTMLDivElement;
    Object.defineProperty(area, 'scrollHeight', { get: () => area.querySelectorAll('.chat-bubble').length * 100 });
    area.scrollTop = 50;
    fireEvent.scroll(area);
    vi.mocked(getMessages).mockResolvedValueOnce({ items: [message(1, 41, 22, 'Oldest')], total: 21, page: 1, size: 20 });
    fireEvent.click(screen.getByRole('button', { name: 'Load older messages' }));
    await screen.findByText('Oldest');
    expect(area.scrollTop).toBe(150);
  });

  it('reconciles selected history on reconnect without reloading on selection', async () => {
    await openMessages('/app/chat/41');
    await waitFor(() => expect(screen.getByLabelText('Message').hasAttribute('disabled')).toBe(false));
    const handlers = socket.handlers.get(41) as { onStateChange: (state: string) => void };
    act(() => handlers.onStateChange('connected'));
    vi.mocked(getMessages).mockResolvedValue({ items: [message(7, 41, 22, 'Missed while offline')], total: 1, page: 0, size: 20 });
    act(() => { handlers.onStateChange('reconnecting'); handlers.onStateChange('connected'); });
    await waitFor(() => expect(document.querySelector('.chat-bubble p')?.textContent).toBe('Missed while offline'));
    expect(getMessages).toHaveBeenCalledTimes(2);
    expect(getConversations).toHaveBeenCalledTimes(1);
  });

  it('loads only a newly discovered conversation and preserves all activity during its request', async () => {
    let resolveDetail!: (detail: ConversationDetail) => void;
    vi.mocked(getConversationDetail).mockImplementationOnce(() => new Promise((resolve) => { resolveDetail = resolve; }));
    await openMessages();
    await screen.findByRole('button', { name: /Rowan Park/ });
    const handlers = socket.activityHandlers as { onActivity: (message: ChatMessage, sender: string) => void };
    act(() => {
      handlers.onActivity(message(4, 77, 22, 'First activity'), 'Rowan');
      handlers.onActivity(message(5, 77, 22, 'Newest activity'), 'Rowan');
    });
    await act(async () => resolveDetail({ conversationId: 77, type: 'DIRECT', participants: [mira, rowan], createdAt: '', updatedAt: '' }));
    expect(await screen.findByRole('link', { name: /Newest activity/ })).toBeTruthy();
    expect(getConversationDetail).toHaveBeenCalledTimes(1);
    expect(getConversations).toHaveBeenCalledTimes(1);
  });

  it('ignores late history from a conversation after switching to a group', async () => {
    let resolveMessages!: (response: { items: ChatMessage[]; total: number; page: number; size: number }) => void;
    vi.mocked(getConversations).mockResolvedValue({ items: [directConversation, groupConversation] });
    vi.mocked(getMessages).mockImplementationOnce(() => new Promise((resolve) => { resolveMessages = resolve; }));
    await openMessages('/app/chat/41');
    await screen.findByRole('link', { name: /Trip crew/ });
    fireEvent.click(screen.getByRole('link', { name: /Trip crew/ }));
    await screen.findByRole('button', { name: 'Group info' });
    await act(async () => resolveMessages({ items: [message(1, 41, 22, 'Stale direct history')], total: 1, page: 0, size: 20 }));
    expect(screen.queryByText('Stale direct history')).toBeNull();
    expect(document.querySelector('.chat-person-details strong')?.textContent).toBe('Trip crew');
    expect(getConversations).toHaveBeenCalledTimes(1);
    expect(getFriends).toHaveBeenCalledTimes(1);
  });

  it('keeps my five-message allowance when the other participant sends messages', async () => {
    vi.mocked(getConversationDetail).mockResolvedValue({ conversationId: 41, type: 'DIRECT', participants: [mira, rowan], createdAt: '', updatedAt: '', limitedMessagesRemaining: 5 });
    await openMessages('/app/chat/41');
    await screen.findByText('5 of 5 messages remaining.');
    act(() => {
      for (let id = 1; id <= 5; id++) (socket.handlers.get(41) as Handlers).onMessage(message(id, 41, 22, `Their message ${id}`));
    });
    expect(screen.getByText('5 of 5 messages remaining.')).toBeTruthy();
    expect(screen.getByLabelText('Message').hasAttribute('disabled')).toBe(false);
    const mine = message(6, 41, 9, 'My first message');
    act(() => {
      (socket.handlers.get(41) as Handlers).onMessage(mine);
      (socket.handlers.get(41) as Handlers).onMessage(mine);
    });
    expect(screen.getByText('4 of 5 messages remaining.')).toBeTruthy();
  });

  it('stops keyboard and button sends after the fifth pre-friendship message', async () => {
    vi.mocked(getConversationDetail).mockResolvedValue({ conversationId: 41, type: 'DIRECT', participants: [mira, rowan], createdAt: '', updatedAt: '', limitedMessagesRemaining: 1 });
    await openMessages('/app/chat/41');
    await screen.findByText('1 of 5 messages remaining.');
    const input = screen.getByLabelText('Message');
    fireEvent.change(input, { target: { value: 'Sixth attempt' } });
    act(() => (socket.handlers.get(41) as Handlers).onMessage(message(5, 41, 9, 'Fifth message')));
    expect(screen.getByText('Message limit reached.')).toBeTruthy();
    expect(input.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(true);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('refreshes exhausted quota after another tab uses the last slot and preserves the rejected draft', async () => {
    const { ApiError } = await import('../../api/client');
    vi.mocked(getConversationDetail).mockResolvedValueOnce({ conversationId: 41, type: 'DIRECT', participants: [mira, rowan], createdAt: '', updatedAt: '', limitedMessagesRemaining: 1 });
    vi.mocked(sendMessage).mockRejectedValueOnce(new ApiError('This conversation is limited to 5 messages.', 400));
    await openMessages('/app/chat/41');
    await screen.findByText('1 of 5 messages remaining.');
    vi.mocked(getConversationDetail).mockResolvedValue({ conversationId: 41, type: 'DIRECT', participants: [mira, rowan], createdAt: '', updatedAt: '', limitedMessagesRemaining: 0 });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Draft kept' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Message limit reached.');
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('Draft kept');
    expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(true);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('accepts an incoming friend request inside the limited chat and immediately restores sending without losing the draft', async () => {
    vi.mocked(getConversationDetail).mockResolvedValue({ conversationId: 41, type: 'DIRECT', participants: [mira, rowan], createdAt: '', updatedAt: '', limitedMessagesRemaining: 1 });
    vi.mocked(getIncomingFriendRequests).mockResolvedValueOnce({ items: [{ requestId: 71, user: rowan, createdAt: '' }] });
    let resolveAccept!: (response: Awaited<ReturnType<typeof acceptFriendRequest>>) => void;
    vi.mocked(acceptFriendRequest).mockImplementationOnce(() => new Promise((resolve) => { resolveAccept = resolve; }));
    await openMessages('/app/chat/41');
    const accept = await screen.findByRole('button', { name: 'Accept friend request' });
    const input = screen.getByLabelText('Message') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Draft after friendship' } });
    act(() => (socket.handlers.get(41) as Handlers).onMessage(message(5, 41, 9, 'My fifth message')));
    expect(input.disabled).toBe(true);
    fireEvent.click(accept);
    fireEvent.click(accept);
    expect(acceptFriendRequest).toHaveBeenCalledTimes(1);
    expect(acceptFriendRequest).toHaveBeenCalledWith(71, 'session-token');
    expect(input.disabled).toBe(true);
    await act(async () => resolveAccept({ requestId: 71, senderId: 22, receiverId: 9, status: 'ACCEPTED', createdAt: '', updatedAt: '' }));
    expect(input.disabled).toBe(false);
    expect(input.value).toBe('Draft after friendship');
    expect(screen.queryByText('Message limit reached.')).toBeNull();
    expect(getConversations).toHaveBeenCalledTimes(1);
    vi.mocked(sendMessage).mockResolvedValueOnce(message(6, 41, 9, 'Draft after friendship'));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(input.value).toBe(''));
    expect(sendMessage).toHaveBeenCalledWith(41, { content: 'Draft after friendship' }, 'session-token');
  });

  it('sends a friend request in chat, waits for acceptance, then reconciles friendship without leaving chat', async () => {
    vi.mocked(getConversationDetail).mockResolvedValue({ conversationId: 41, type: 'DIRECT', participants: [mira, rowan], createdAt: '', updatedAt: '', limitedMessagesRemaining: 0 });
    vi.mocked(sendFriendRequest).mockResolvedValueOnce({ requestId: 72, senderId: 9, receiverId: 22, status: 'PENDING', createdAt: '', updatedAt: '' });
    await openMessages('/app/chat/41');
    fireEvent.click(await screen.findByRole('button', { name: 'Add friend' }));
    await screen.findByText('Friend request sent. Waiting for acceptance.');
    expect(sendFriendRequest).toHaveBeenCalledWith(22, 'session-token');
    expect(screen.getByLabelText('Message').hasAttribute('disabled')).toBe(true);
    expect(acceptFriendRequest).not.toHaveBeenCalled();
    vi.mocked(getConversationDetail).mockResolvedValue({ conversationId: 41, type: 'DIRECT', participants: [mira, rowan], createdAt: '', updatedAt: '', limitedMessagesRemaining: null });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh friendship' }));
    await waitFor(() => expect(screen.getByLabelText('Message').hasAttribute('disabled')).toBe(false));
    expect(screen.queryByText('Message limit reached.')).toBeNull();
    expect(getConversations).toHaveBeenCalledTimes(1);
  });

  it('keeps the quota when accepting friendship fails and offers reconciliation', async () => {
    const { ApiError } = await import('../../api/client');
    vi.mocked(getConversationDetail).mockResolvedValue({ conversationId: 41, type: 'DIRECT', participants: [mira, rowan], createdAt: '', updatedAt: '', limitedMessagesRemaining: 0 });
    vi.mocked(getIncomingFriendRequests).mockResolvedValueOnce({ items: [{ requestId: 71, user: rowan, createdAt: '' }] });
    vi.mocked(acceptFriendRequest).mockRejectedValueOnce(new ApiError('Unable to accept right now.', 500));
    await openMessages('/app/chat/41');
    fireEvent.click(await screen.findByRole('button', { name: 'Accept friend request' }));
    await screen.findByText('Unable to accept right now.');
    expect(screen.getByLabelText('Message').hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Message limit reached.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Refresh friendship' })).toBeTruthy();
  });

  it('shows direct/group unread badges, caps 99+, and combines local Unread filtering with search', async () => {
    vi.mocked(getConversations).mockResolvedValue({ items: [
      { ...directConversation, unreadCount: 3, readStateVersion: 1 },
      { ...groupConversation, groupName: 'Unread crew', unreadCount: 120, readStateVersion: 2 },
      { ...directConversation, conversationId: 42, participant: { userId: 23, username: 'sam', displayName: 'Sam' }, unreadCount: 0 },
    ] });
    await openMessages('/app/chat/42');
    await screen.findByLabelText('3 unread messages');
    expect(screen.getByLabelText('120 unread messages').textContent).toBe('99+');
    const sidebar = screen.getByRole('complementary', { name: 'Friends and conversations' });
    expect(within(sidebar).getAllByRole('link')[0].textContent).toContain('Unread crew');
    fireEvent.click(screen.getByRole('button', { name: 'Unread', exact: true }));
    expect(screen.getByRole('button', { name: 'Unread', exact: true }).getAttribute('aria-pressed')).toBe('true');
    expect(within(sidebar).queryByRole('link', { name: /Sam/ })).toBeNull();
    expect(window.location.pathname).toBe('/app/chat/42');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'crew' } });
    expect(within(sidebar).getAllByRole('link')).toHaveLength(1);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'missing' } });
    expect(screen.getByText('No unread conversations match your search.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    fireEvent.click(screen.getByRole('button', { name: 'All', exact: true }));
    expect(within(sidebar).getAllByRole('link')).toHaveLength(3);
    expect(getConversations).toHaveBeenCalledTimes(1);
  });

  it('uses authoritative realtime versions to avoid duplicated, delayed or cross-tab unread changes', async () => {
    vi.mocked(getConversations).mockResolvedValue({ items: [{ ...directConversation, unreadCount: 0, readStateVersion: 0 }] });
    await openMessages();
    await screen.findByRole('link', { name: /Earlier note/ });
    const handlers = socket.activityHandlers as { onActivity: (message: ChatMessage, sender: string, state: { conversationId: number; unreadCount: number; readStateVersion: number }) => void; onReadState: (state: { conversationId: number; unreadCount: number; readStateVersion: number }) => void };
    const event = message(3, 41, 22, 'Incoming unread');
    act(() => {
      handlers.onActivity(event, 'Rowan', { conversationId: 41, unreadCount: 1, readStateVersion: 1 });
      handlers.onActivity(event, 'Rowan', { conversationId: 41, unreadCount: 1, readStateVersion: 1 });
    });
    expect(screen.getAllByLabelText('1 unread messages')).toHaveLength(1);
    act(() => handlers.onReadState({ conversationId: 41, unreadCount: 0, readStateVersion: 2 }));
    expect(screen.queryByLabelText('1 unread messages')).toBeNull();
    act(() => handlers.onActivity(event, 'Rowan', { conversationId: 41, unreadCount: 1, readStateVersion: 1 }));
    expect(screen.queryByLabelText('1 unread messages')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Unread', exact: true }));
    expect(screen.getByText('No unread conversations.')).toBeTruthy();
    expect(getConversations).toHaveBeenCalledTimes(1);
  });

  it('acknowledges viewed messages, removes the unread row while preserving the selected chat and scroll', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    vi.mocked(getConversations).mockResolvedValue({ items: [{ ...directConversation, unreadCount: 1, readStateVersion: 1 }] });
    vi.mocked(getMessages).mockResolvedValue({ items: [message(1, 41, 22, 'View me')], total: 1, page: 0, size: 20 });
    vi.mocked(markConversationRead).mockResolvedValue({ conversationId: 41, unreadCount: 0, readStateVersion: 2 });
    await openMessages('/app/chat/41');
    await screen.findByText('View me');
    fireEvent.click(screen.getByRole('button', { name: 'Unread', exact: true }));
    const area = document.querySelector('.chat-message-area') as HTMLDivElement;
    Object.defineProperty(area, 'clientHeight', { configurable: true, value: 200 });
    area.getBoundingClientRect = () => ({ top: 0, bottom: 200, height: 200 }) as DOMRect;
    const row = area.querySelector<HTMLElement>('[data-message-id]')!;
    row.getBoundingClientRect = () => ({ top: 10, bottom: 50, height: 40 }) as DOMRect;
    area.scrollTop = 75;
    fireEvent.scroll(area);
    await waitFor(() => { expect(markConversationRead).toHaveBeenCalledWith(41, 1, 'session-token'); expect(screen.queryByLabelText('1 unread messages')).toBeNull(); });
    expect(markConversationRead).toHaveBeenCalledWith(41, 1, 'session-token');
    expect(screen.getByLabelText('Message')).toBeTruthy();
    expect(window.location.pathname).toBe('/app/chat/41');
    expect(area.scrollTop).toBe(75);
    expect(getConversations).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it('reconciles unread state on reconnect without moving selection or showing global loading', async () => {
    vi.mocked(getConversations).mockResolvedValue({ items: [{ ...directConversation, unreadCount: 2, readStateVersion: 1 }] });
    await openMessages('/app/chat/41');
    await screen.findByLabelText('2 unread messages');
    const handlers = socket.groupEventHandlers as { onStateChange: (state: string) => void };
    act(() => handlers.onStateChange('connected'));
    vi.mocked(getConversations).mockResolvedValue({ items: [{ ...directConversation, unreadCount: 0, readStateVersion: 2 }] });
    act(() => { handlers.onStateChange('reconnecting'); handlers.onStateChange('connected'); });
    await waitFor(() => expect(screen.queryByLabelText('2 unread messages')).toBeNull());
    expect(window.location.pathname).toBe('/app/chat/41');
    expect(screen.getByLabelText('Message')).toBeTruthy();
    expect(screen.queryByText('Loading conversations?')).toBeNull();
  });

  it('preserves a newer cross-tab read event that arrives before the initial list request finishes', async () => {
    let resolveList!: (response: Awaited<ReturnType<typeof getConversations>>) => void;
    vi.mocked(getConversations).mockImplementationOnce(() => new Promise((resolve) => { resolveList = resolve; }));
    await openMessages();
    await waitFor(() => expect(socket.activityHandlers).not.toBeNull());
    const handlers = socket.activityHandlers as { onReadState: (state: { conversationId: number; unreadCount: number; readStateVersion: number }) => void };
    act(() => handlers.onReadState({ conversationId: 41, unreadCount: 0, readStateVersion: 2 }));
    await act(async () => resolveList({ items: [{ ...directConversation, unreadCount: 4, readStateVersion: 1 }] }));
    await screen.findByRole('link', { name: /Earlier note/ });
    expect(screen.queryByLabelText('4 unread messages')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Unread', exact: true }));
    expect(screen.getByText('No unread conversations.')).toBeTruthy();
  });

  it('renders the split layout with an empty right panel when nothing is selected', async () => {
    await openMessages();
    expect(await screen.findByText('Select a friend or group')).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Friends and conversations' })).toBeTruthy();
    expect(screen.queryByLabelText('Message')).toBeNull();
  });

  it('opens a direct conversation on the right when a friend is clicked', async () => {
    await openMessages();
    fireEvent.click(await screen.findByRole('button', { name: /Rowan Park/ }));

    expect(await screen.findByLabelText('Message')).toBeTruthy();
    expect(await screen.findByText('Offline')).toBeTruthy();
    act(() => socket.presenceHandlers.get(22)?.({ userId: 22, online: true }));
    expect(screen.getByText('Online')).toBeTruthy();
    act(() => socket.presenceHandlers.get(22)?.({ userId: 22, online: false }));
    expect(screen.getByText('Offline')).toBeTruthy();
    expect(openDirectConversation).toHaveBeenCalledWith(22, 'session-token');
    expect(getMessages).toHaveBeenCalledWith(41, 0, 20, 'session-token');
    expect(window.location.pathname).toBe('/app/chat/41');
  });

  it('disables the composer when a nearby conversation has used all five messages', async () => {
    vi.mocked(getConversationDetail).mockResolvedValue({
      conversationId: 41, type: 'DIRECT', participants: [mira, rowan], createdAt: '', updatedAt: '',
      limitedMessagesRemaining: 0,
    });
    await openMessages('/app/chat/41');

    expect(await screen.findByText('Message limit reached.')).toBeTruthy();
    expect(screen.getByLabelText('Message').hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(true);
  });

  it('opens a group, shows the group name and sender identity, and ignores a duplicate socket frame', async () => {
    vi.mocked(getConversations).mockResolvedValue({ items: [groupConversation] });
    vi.mocked(getMessages).mockResolvedValue({ items: [message(1, 50, 22, 'Hello team')], total: 1, page: 0, size: 20 });
    await openMessages();

    fireEvent.click(await screen.findByRole('link', { name: /Trip crew/ }));
    expect(await screen.findByText('Hello team')).toBeTruthy();
    expect(getGroup).toHaveBeenCalledWith(50, 'session-token');
    expect(screen.getAllByText('Rowan Park').length).toBeGreaterThan(0);
    await act(async () => (socket.handlers.get(50) as Handlers).onMessage(message(1, 50, 22, 'Hello team')));
    expect(screen.getAllByText('Hello team')).toHaveLength(1);
  });

  it('unsubscribes the previous conversation when switching', async () => {
    vi.mocked(getConversations).mockResolvedValue({ items: [directConversation, groupConversation] });
    await openMessages();

    fireEvent.click(await screen.findByRole('link', { name: /Earlier note/ }));
    await screen.findByLabelText('Message');
    await waitFor(() => expect(socket.handlers.has(41)).toBe(true));
    fireEvent.click(await screen.findByRole('link', { name: /Trip crew/ }));

    await waitFor(() => expect(socket.handlers.has(50)).toBe(true));
    expect(socket.unsubscribe.get(41)).toHaveBeenCalled();
    expect(socket.unsubscribe.get(50)).not.toHaveBeenCalled();
  });

  it('validates the group name and creates a group, then opens it', async () => {
    vi.mocked(createGroup).mockResolvedValue({ ...groupInfo(9), groupId: 60, name: 'Trip' });
    await openMessages();
    fireEvent.click(await screen.findByRole('button', { name: 'Create group' }));
    const form = await screen.findByRole('form', { name: 'Create group' });

    fireEvent.click(within(form).getByRole('button', { name: 'Create group' }));
    expect(await screen.findByText('Enter a group name.')).toBeTruthy();
    expect(createGroup).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Group name'), { target: { value: '  Trip  ' } });
    fireEvent.click(within(form).getByRole('checkbox'));
    fireEvent.click(within(form).getByRole('button', { name: 'Create group' }));

    await waitFor(() => expect(createGroup).toHaveBeenCalledWith({ name: 'Trip', memberIds: [22] }, 'session-token'));
    await waitFor(() => expect(window.location.pathname).toBe('/app/chat/60'));
  });

  it('shows a confirmation dialog before a member leaves and clears the selected conversation', async () => {
    vi.mocked(getConversations).mockResolvedValue({ items: [groupConversation] });
    vi.mocked(leaveGroup).mockResolvedValue(undefined);
    await openMessages('/app/chat/50');

    fireEvent.click(await screen.findByRole('button', { name: 'Group info' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Leave group' }));
    const dialog = await screen.findByRole('dialog', { name: 'Leave this group?' });
    expect(within(dialog).getByText(/lose access to this conversation/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Leave group' }));

    await waitFor(() => expect(leaveGroup).toHaveBeenCalledWith(50, 'session-token'));
    expect(await screen.findByText('Select a friend or group')).toBeTruthy();
  });

  it('does not offer the owner a leave action', async () => {
    vi.mocked(getConversations).mockResolvedValue({ items: [groupConversation] });
    vi.mocked(getGroup).mockResolvedValue(groupInfo(9));
    await openMessages('/app/chat/50');

    fireEvent.click(await screen.findByRole('button', { name: 'Group info' }));

    expect(await screen.findByText(/Owners cannot leave/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Leave group' })).toBeNull();
  });

  it('lets the owner delete a group after confirming and clears the selection', async () => {
    vi.mocked(getConversations).mockResolvedValue({ items: [groupConversation] });
    vi.mocked(getGroup).mockResolvedValue(groupInfo(9));
    vi.mocked(deleteGroup).mockResolvedValue(undefined);
    await openMessages('/app/chat/50');

    fireEvent.click(await screen.findByRole('button', { name: 'Group info' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete group' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this group?' });
    expect(deleteGroup).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete group' }));

    await waitFor(() => expect(deleteGroup).toHaveBeenCalledWith(50, 'session-token'));
    expect(await screen.findByText('Select a friend or group')).toBeTruthy();
  });

  it('removes a group deleted by its owner from the list and closes it', async () => {
    vi.mocked(getConversations).mockResolvedValue({ items: [groupConversation] });
    await openMessages('/app/chat/50');
    await screen.findAllByText('Trip crew');

    const handlers = socket.groupEventHandlers as { onEvent: (event: GroupManagementEvent) => void };
    act(() => handlers.onEvent({
      type: 'GROUP_DELETED', group: { ...groupInfo(22), memberCount: 0 },
      member: { user: mira, role: 'MEMBER', joinedAt: '' },
    }));

    expect(await screen.findByText('Select a friend or group')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Trip crew/ })).toBeNull();
  });

  it('requires at least one friend before creating a group', async () => {
    await openMessages();
    fireEvent.click(await screen.findByRole('button', { name: 'Create group' }));
    const form = await screen.findByRole('form', { name: 'Create group' });
    fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'Solo' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Create group' }));

    expect(await screen.findByText('Select at least one friend to add to the group.')).toBeTruthy();
    expect(createGroup).not.toHaveBeenCalled();
  });

  it('does not reload the conversation list when switching conversations', async () => {
    vi.mocked(getConversations).mockResolvedValue({ items: [directConversation, groupConversation] });
    await openMessages();
    fireEvent.click(await screen.findByRole('link', { name: /Earlier note/ }));
    await screen.findByLabelText('Message');
    fireEvent.click(await screen.findByRole('link', { name: /Trip crew/ }));
    await waitFor(() => expect(socket.handlers.has(50)).toBe(true));

    expect(getConversations).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Loading conversations…')).toBeNull();
  });

  it('shows management controls only to the group owner', async () => {
    vi.mocked(getConversations).mockResolvedValue({ items: [groupConversation] });
    await openMessages('/app/chat/50');

    fireEvent.click(await screen.findByRole('button', { name: 'Group info' }));

    expect(await screen.findByText('Your role: member')).toBeTruthy();
    expect(screen.queryByRole('form', { name: 'Rename group' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add members' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Remove / })).toBeNull();
    expect(screen.getByRole('button', { name: 'Leave group' })).toBeTruthy();
  });

  it('lets the owner rename a group and updates the header and conversation list', async () => {
    vi.mocked(getConversations).mockResolvedValue({ items: [groupConversation] });
    vi.mocked(getGroup).mockResolvedValue(groupInfo(9));
    vi.mocked(renameGroup).mockResolvedValue({ ...groupInfo(9), name: 'New trip crew', updatedAt: '2026-10-08T12:00:00Z' });
    await openMessages('/app/chat/50');

    fireEvent.click(await screen.findByRole('button', { name: 'Group info' }));
    fireEvent.change(await screen.findByLabelText('Group name'), { target: { value: '  New trip crew  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));

    await waitFor(() => expect(renameGroup).toHaveBeenCalledWith(50, 'New trip crew', 'session-token'));
    expect((await screen.findAllByText('New trip crew')).length).toBeGreaterThan(0);
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByRole('link', { name: /New trip crew/ })).toBeTruthy();
  });

  it('synchronizes group updates from realtime events and clears a removed member selection', async () => {
    vi.mocked(getConversations).mockResolvedValue({ items: [groupConversation] });
    await openMessages('/app/chat/50');
    await screen.findAllByText('Trip crew');

    const handlers = socket.groupEventHandlers as { onEvent: (event: GroupManagementEvent) => void };
    const renameEvent: GroupManagementEvent = {
      type: 'GROUP_RENAMED', group: { ...groupInfo(22), name: 'Live trip crew' }, member: null,
    };
    act(() => handlers.onEvent(renameEvent));
    act(() => handlers.onEvent(renameEvent));
    expect((await screen.findAllByText('Live trip crew')).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Live trip crew/ })).toHaveLength(1);

    act(() => handlers.onEvent({
      type: 'MEMBER_REMOVED', group: { ...groupInfo(22), name: 'Live trip crew', memberCount: 1 },
      member: { user: mira, role: 'MEMBER', joinedAt: '' },
    }));
    expect(await screen.findByText('Select a friend or group')).toBeTruthy();
  });

  it('clears a selected group on reconnect when the refreshed conversation list no longer includes it', async () => {
    vi.mocked(getConversations).mockResolvedValue({ items: [groupConversation] });
    await openMessages('/app/chat/50');
    await screen.findAllByText('Trip crew');
    const handlers = socket.groupEventHandlers as { onStateChange: (state: 'connected' | 'reconnecting') => void };
    act(() => handlers.onStateChange('connected'));
    vi.mocked(getConversations).mockResolvedValue({ items: [] });
    act(() => handlers.onStateChange('reconnecting'));
    act(() => handlers.onStateChange('connected'));

    expect(await screen.findByText('Select a friend or group')).toBeTruthy();
    expect(window.location.pathname).toBe('/app/chat');
  });

  it('lets the owner add members more than once and remove a member', async () => {
    const sam = { userId: 33, username: 'sam', displayName: 'Sam Lee' };
    const zoe = { userId: 34, username: 'zoe', displayName: 'Zoe Hart' };
    vi.mocked(getFriends).mockResolvedValue({ items: [rowan, sam, zoe, mira] });
    vi.mocked(getConversations).mockResolvedValue({ items: [groupConversation] });
    vi.mocked(getGroup).mockResolvedValue(groupInfo(9));
    let memberSnapshot = [
      { user: mira, role: 'OWNER', joinedAt: '' }, { user: rowan, role: 'MEMBER', joinedAt: '' },
    ];
    vi.mocked(getGroupMembers).mockImplementation(async () => ({ items: [...memberSnapshot] }));
    vi.mocked(addGroupMembers).mockImplementation(async (_groupId, memberIds) => {
      const friends = new Map([[sam.userId, sam], [zoe.userId, zoe]]);
      memberSnapshot = [...memberSnapshot, ...memberIds.map((userId) => ({
        user: friends.get(userId)!, role: 'MEMBER', joinedAt: '',
      }))];
      return { ...groupInfo(9), memberCount: memberSnapshot.length };
    });
    vi.mocked(removeGroupMember).mockImplementation(async (_groupId, userId) => {
      memberSnapshot = memberSnapshot.filter((member) => member.user.userId !== userId);
      return { ...groupInfo(9), memberCount: memberSnapshot.length };
    });
    await openMessages('/app/chat/50');

    fireEvent.click(await screen.findByRole('button', { name: 'Group info' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add members' }));
    expect(screen.queryByRole('checkbox', { name: /Mira Vale/ })).toBeNull();
    fireEvent.click(await screen.findByRole('checkbox', { name: /Sam Lee/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add selected' }));
    await waitFor(() => expect(addGroupMembers).toHaveBeenCalledWith(50, [33], 'session-token'));
    expect((await screen.findAllByText('Sam Lee')).length).toBeGreaterThan(0);

    fireEvent.click(await screen.findByRole('button', { name: 'Add members' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /Zoe Hart/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add selected' }));
    await waitFor(() => expect(addGroupMembers).toHaveBeenLastCalledWith(50, [34], 'session-token'));

    fireEvent.click(await screen.findByRole('button', { name: 'More actions for Rowan Park' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Remove from group' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove this member?' });
    expect(within(dialog).getByText(/Rowan Park will lose access/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove member' }));
    memberSnapshot = memberSnapshot.filter((member) => member.user.userId !== rowan.userId);
    await waitFor(() => expect(removeGroupMember).toHaveBeenCalledWith(50, 22, 'session-token'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'More actions for Rowan Park' })).toBeNull());
  });

  it('offers add-friend and message actions for a group member', async () => {
    const { sendFriendRequest } = await import('../../api/friends');
    vi.mocked(getConversations).mockResolvedValue({ items: [groupConversation] });
    vi.mocked(getFriends).mockResolvedValue({ items: [] });
    vi.mocked(sendFriendRequest).mockResolvedValue({ requestId: 99, senderId: 9, receiverId: 22, status: 'PENDING', createdAt: '', updatedAt: '' });
    vi.mocked(openContextualConversation).mockResolvedValue({ conversationId: 61, type: 'DIRECT', participant: rowan });
    await openMessages('/app/chat/50');

    fireEvent.click(await screen.findByRole('button', { name: 'Group info' }));
    fireEvent.click(await screen.findByRole('button', { name: 'More actions for Rowan Park' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Add friend' }));
    expect(sendFriendRequest).toHaveBeenCalledWith(22, 'session-token');
    expect(await screen.findByText('Friend request sent to Rowan Park.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Rowan Park' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Message' }));
    await waitFor(() => expect(openContextualConversation).toHaveBeenCalledWith(22, undefined, 'session-token'));
    expect(window.location.pathname).toBe('/app/chat/61');
  });

  it('shows an access error when the backend rejects the conversation', async () => {
    const { ApiError } = await import('../../api/client');
    vi.mocked(getConversationDetail).mockRejectedValue(new ApiError('Forbidden', 403));
    await openMessages('/app/chat/50');

    expect((await screen.findByRole('alert')).textContent).toContain('no longer have access');
    expect(screen.queryByLabelText('Message')).toBeNull();
  });
});
