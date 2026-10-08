import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { getCurrentUser } from '../../api/auth';
import { getFriends } from '../../api/friends';
import { getConversationDetail, getConversations, getMessages, openDirectConversation } from '../../api/chats';
import { addGroupMembers, createGroup, getGroup, getGroupMembers, leaveGroup, removeGroupMember } from '../../api/groups';
import { ChatMessage, ConversationDetail, GroupInfo, User } from '../../types';

type Handlers = { onMessage: (message: ChatMessage) => void };

const socket = vi.hoisted(() => ({
  handlers: new Map<number, unknown>(),
  unsubscribe: new Map<number, ReturnType<typeof vi.fn>>(),
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
vi.mock('../../api/friends', () => ({ getFriends: vi.fn() }));
vi.mock('../../api/chats', () => ({
  getConversations: vi.fn(),
  getConversationDetail: vi.fn(),
  getMessages: vi.fn(),
  openDirectConversation: vi.fn(),
  sendMessage: vi.fn(),
}));
vi.mock('../../api/groups', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/groups')>()),
  createGroup: vi.fn(),
  getGroup: vi.fn(),
  getGroupMembers: vi.fn(),
  leaveGroup: vi.fn(),
  addGroupMembers: vi.fn(),
  removeGroupMember: vi.fn(),
}));
vi.mock('../../services/chatWebSocket', () => ({
  subscribeToConversation: vi.fn((id: number, _token: string, handlers: unknown) => {
    socket.handlers.set(id, handlers);
    const unsubscribe = vi.fn();
    socket.unsubscribe.set(id, unsubscribe);
    return unsubscribe;
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
    vi.mocked(getCurrentUser).mockResolvedValue(me);
    vi.mocked(getFriends).mockResolvedValue({ items: [rowan] });
    vi.mocked(getConversations).mockResolvedValue({ items: [] });
    vi.mocked(getConversationDetail).mockImplementation(async (id): Promise<ConversationDetail> => ({
      conversationId: id, type: id === 50 || id === 60 ? 'GROUP' : 'DIRECT', participants: [mira, rowan], createdAt: '', updatedAt: '',
    }));
    vi.mocked(getMessages).mockResolvedValue({ items: [], total: 0, page: 0, size: 20 });
    vi.mocked(getGroup).mockResolvedValue(groupInfo(22));
    vi.mocked(getGroupMembers).mockResolvedValue({ items: [
      { user: rowan, role: 'OWNER', joinedAt: '' }, { user: mira, role: 'MEMBER', joinedAt: '' },
    ] });
    vi.mocked(openDirectConversation).mockResolvedValue({ conversationId: 41, type: 'DIRECT', participant: rowan });
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
    expect(openDirectConversation).toHaveBeenCalledWith(22, 'session-token');
    expect(getMessages).toHaveBeenCalledWith(41, 0, 20, 'session-token');
    expect(window.location.pathname).toBe('/app/chat/41');
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

  it('confirms before a member leaves and clears the selected conversation', async () => {
    vi.mocked(getConversations).mockResolvedValue({ items: [groupConversation] });
    vi.mocked(leaveGroup).mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await openMessages('/app/chat/50');

    fireEvent.click(await screen.findByRole('button', { name: 'Group info' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Leave group' }));

    await waitFor(() => expect(leaveGroup).toHaveBeenCalledWith(50, 'session-token'));
    expect(confirm).toHaveBeenCalledWith('Are you sure you want to leave this group?');
    expect(await screen.findByText('Select a friend or group')).toBeTruthy();
    confirm.mockRestore();
  });

  it('does not offer the owner a leave action', async () => {
    vi.mocked(getConversations).mockResolvedValue({ items: [groupConversation] });
    vi.mocked(getGroup).mockResolvedValue(groupInfo(9));
    await openMessages('/app/chat/50');

    fireEvent.click(await screen.findByRole('button', { name: 'Group info' }));

    expect(await screen.findByText(/Owners cannot leave/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Leave group' })).toBeNull();
  });

  it('lets the owner add members more than once and remove a member', async () => {
    const sam = { userId: 33, username: 'sam', displayName: 'Sam Lee' };
    const zoe = { userId: 34, username: 'zoe', displayName: 'Zoe Hart' };
    vi.mocked(getFriends).mockResolvedValue({ items: [rowan, sam, zoe] });
    vi.mocked(getConversations).mockResolvedValue({ items: [groupConversation] });
    vi.mocked(getGroup).mockResolvedValue(groupInfo(9));
    vi.mocked(getGroupMembers).mockResolvedValue({ items: [
      { user: mira, role: 'OWNER', joinedAt: '' }, { user: rowan, role: 'MEMBER', joinedAt: '' },
    ] });
    vi.mocked(addGroupMembers).mockResolvedValue({ ...groupInfo(9), memberCount: 3 });
    vi.mocked(removeGroupMember).mockResolvedValue({ ...groupInfo(9), memberCount: 1 });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await openMessages('/app/chat/50');

    fireEvent.click(await screen.findByRole('button', { name: 'Group info' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add members' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /Sam Lee/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add selected' }));
    await waitFor(() => expect(addGroupMembers).toHaveBeenCalledWith(50, [33], 'session-token'));

    fireEvent.click(await screen.findByRole('button', { name: 'Add members' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /Zoe Hart/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add selected' }));
    await waitFor(() => expect(addGroupMembers).toHaveBeenLastCalledWith(50, [34], 'session-token'));

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Rowan Park' }));
    await waitFor(() => expect(removeGroupMember).toHaveBeenCalledWith(50, 22, 'session-token'));
    expect(confirm).toHaveBeenCalledWith('Remove Rowan Park from this group?');
    confirm.mockRestore();
  });

  it('shows an access error when the backend rejects the conversation', async () => {
    const { ApiError } = await import('../../api/client');
    vi.mocked(getConversationDetail).mockRejectedValue(new ApiError('Forbidden', 403));
    await openMessages('/app/chat/50');

    expect((await screen.findByRole('alert')).textContent).toContain('no longer have access');
    expect(screen.queryByLabelText('Message')).toBeNull();
  });
});
