import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getConversationDetail } from '../../api/chats';
import { getIncomingFriendRequests, getOutgoingFriendRequests } from '../../api/friends';
import { LimitedChatFriendship } from './LimitedChatFriendship';
import { AppNotification } from '../../types';

const state = vi.hoisted(() => ({ notifications: [] as AppNotification[] }));
vi.mock('../../app/providers/NotificationContext', () => ({ useNotifications: () => state }));
vi.mock('../../api/chats', () => ({ getConversationDetail: vi.fn() }));
vi.mock('../../api/friends', () => ({ getIncomingFriendRequests: vi.fn(), getOutgoingFriendRequests: vi.fn(), acceptFriendRequest: vi.fn(), sendFriendRequest: vi.fn() }));

describe('limited chat friendship synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.notifications = [];
    vi.mocked(getIncomingFriendRequests).mockResolvedValue({ items: [] });
    vi.mocked(getOutgoingFriendRequests).mockResolvedValue({ items: [{ requestId: 71, user: { userId: 22, username: 'rowan', displayName: 'Rowan' }, createdAt: '' }] });
  });

  it('unlocks the sender when the existing notification provider receives acceptance', async () => {
    const onUnlocked = vi.fn();
    const props = { conversationId: 41, participantId: 22, token: 'jwt', onUnlocked };
    const view = render(<LimitedChatFriendship {...props} />);
    await screen.findByText('Friend request sent. Waiting for acceptance.');
    expect(onUnlocked).not.toHaveBeenCalled();
    vi.mocked(getConversationDetail).mockResolvedValue({ conversationId: 41, type: 'DIRECT', participants: [], createdAt: '', updatedAt: '', limitedMessagesRemaining: null });
    state.notifications = [{ id: 99, recipientId: 9, type: 'FRIEND_REQUEST_ACCEPTED', title: 'Accepted', message: '', referenceType: 'FRIEND_REQUEST', referenceId: 71, conversationId: null, read: false, createdAt: '', readAt: null }];
    view.rerender(<LimitedChatFriendship {...props} />);
    await waitFor(() => expect(onUnlocked).toHaveBeenCalledTimes(1));
    expect(getConversationDetail).toHaveBeenCalledWith(41, 'jwt');
  });

  it('does not unlock after switching away while a friendship refresh is pending', async () => {
    let resolveDetail!: (detail: Awaited<ReturnType<typeof getConversationDetail>>) => void;
    vi.mocked(getConversationDetail).mockImplementationOnce(() => new Promise((resolve) => { resolveDetail = resolve; }));
    const onUnlocked = vi.fn();
    const view = render(<LimitedChatFriendship conversationId={41} participantId={22} token="jwt" onUnlocked={onUnlocked} />);
    await screen.findByText('Friend request sent. Waiting for acceptance.');
    act(() => window.dispatchEvent(new Event('focus')));
    view.unmount();
    await act(async () => resolveDetail({ conversationId: 41, type: 'DIRECT', participants: [], createdAt: '', updatedAt: '', limitedMessagesRemaining: null }));
    expect(onUnlocked).not.toHaveBeenCalled();
  });
});
