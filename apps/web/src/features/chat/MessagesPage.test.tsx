import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { getCurrentUser } from '../../api/auth';
import { getFriends } from '../../api/friends';
import { getConversationDetail, getConversationPresence, getConversations, getMessages, openContextualConversation, openDirectConversation } from '../../api/chats';
import { addGroupMembers, createGroup, getGroup, getGroupMembers, leaveGroup, removeGroupMember, renameGroup } from '../../api/groups';
import { ChatMessage, ConversationDetail, GroupInfo, GroupManagementEvent, User } from '../../types';

type Handlers = { onMessage: (message: ChatMessage) => void };
type PresenceHandler = (presence: { userId: number; online: boolean }) => void;

const socket = vi.hoisted(() => ({
  handlers: new Map<number, unknown>(),
  unsubscribe: new Map<number, ReturnType<typeof vi.fn>>(),
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
vi.mock('../../api/friends', () => ({ getFriends: vi.fn(), sendFriendRequest: vi.fn() }));
vi.mock('../../api/chats', () => ({
  getConversations: vi.fn(),
  getConversationDetail: vi.fn(),
  getConversationPresence: vi.fn(),
  getMessages: vi.fn(),
  openDirectConversation: vi.fn(),
  openContextualConversation: vi.fn(),
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
  renameGroup: vi.fn(),
}));
vi.mock('../../services/chatWebSocket', () => ({
  subscribeToConversation: vi.fn((id: number, _token: string, handlers: unknown) => {
    socket.handlers.set(id, handlers);
    const unsubscribe = vi.fn();
    socket.unsubscribe.set(id, unsubscribe);
    return unsubscribe;
  }),
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
