/**
 * Tests for Friend → Chat integration
 *
 * Coverage (PROMPT 015, section 29 — Friend integration):
 *  - Message action opens/creates a direct conversation via API
 *  - navigation to ChatScreen works (onMessageFriend called → resolves conversationId)
 *  - API failure is handled gracefully
 *  - duplicate presses while opening are prevented
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { FriendsScreen } from '../screens/FriendsScreen';
import { ApiError } from '../api/client';

// ---- Mock friendApi ----
jest.mock('../api/friendApi', () => ({
  getFriends: jest.fn(),
  getIncomingFriendRequests: jest.fn(),
  getOutgoingFriendRequests: jest.fn(),
  acceptFriendRequest: jest.fn(),
  rejectFriendRequest: jest.fn(),
  cancelFriendRequest: jest.fn(),
}));

import {
  getFriends,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
} from '../api/friendApi';

const mockGetFriends = getFriends as jest.MockedFunction<typeof getFriends>;
const mockGetIncoming = getIncomingFriendRequests as jest.MockedFunction<typeof getIncomingFriendRequests>;
const mockGetOutgoing = getOutgoingFriendRequests as jest.MockedFunction<typeof getOutgoingFriendRequests>;

const FAKE_TOKEN = 'test-token';

const makeFriend = (id: number, displayName: string) => ({
  userId: id,
  displayName,
  username: displayName.toLowerCase(),
});

function setupDefaultMocks(friends = [makeFriend(2, 'Alice')]) {
  mockGetFriends.mockResolvedValue({ items: friends });
  mockGetIncoming.mockResolvedValue({ items: [] });
  mockGetOutgoing.mockResolvedValue({ items: [] });
}

describe('FriendsScreen — Friend → Chat integration', () => {
  const onBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Message action opens/creates a conversation
  // --------------------------------------------------------------------------
  it('calls onMessageFriend with the correct friend when Message is pressed', async () => {
    setupDefaultMocks();
    const onMessageFriend = jest.fn().mockResolvedValue(undefined);

    render(
      <FriendsScreen
        token={FAKE_TOKEN}
        onBack={onBack}
        onMessageFriend={onMessageFriend}
      />,
    );

    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy());

    fireEvent.press(screen.getByText('Message'));

    await waitFor(() => {
      expect(onMessageFriend).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 2, displayName: 'Alice' }),
      );
    });
  });

  // --------------------------------------------------------------------------
  // Navigation to ChatScreen (via onMessageFriend)
  // --------------------------------------------------------------------------
  it('navigates to chat after onMessageFriend resolves', async () => {
    setupDefaultMocks();

    let resolved = false;
    const onMessageFriend = jest.fn().mockImplementation(async () => {
      resolved = true;
    });

    render(
      <FriendsScreen
        token={FAKE_TOKEN}
        onBack={onBack}
        onMessageFriend={onMessageFriend}
      />,
    );

    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy());
    fireEvent.press(screen.getByText('Message'));
    await waitFor(() => expect(resolved).toBe(true));
    expect(onMessageFriend).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // API failure handled gracefully
  // --------------------------------------------------------------------------
  it('shows an error when onMessageFriend fails with ApiError', async () => {
    setupDefaultMocks();
    const onMessageFriend = jest.fn().mockRejectedValue(
      new ApiError('Unable to open this conversation.', 'server', 500),
    );

    render(
      <FriendsScreen
        token={FAKE_TOKEN}
        onBack={onBack}
        onMessageFriend={onMessageFriend}
      />,
    );

    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy());
    fireEvent.press(screen.getByText('Message'));

    await waitFor(() => {
      expect(screen.getByText('Unable to open this conversation.')).toBeTruthy();
    });
  });

  it('shows a generic error when onMessageFriend fails with unknown error', async () => {
    setupDefaultMocks();
    const onMessageFriend = jest.fn().mockRejectedValue(new Error('Network error'));

    render(
      <FriendsScreen
        token={FAKE_TOKEN}
        onBack={onBack}
        onMessageFriend={onMessageFriend}
      />,
    );

    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy());
    fireEvent.press(screen.getByText('Message'));

    await waitFor(() => {
      expect(screen.getByText(/Unable to open this conversation/i)).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // Duplicate press prevention
  // --------------------------------------------------------------------------
  it('prevents calling onMessageFriend multiple times for the same friend while request is pending', async () => {
    setupDefaultMocks();

    let resolveRequest!: () => void;
    const onMessageFriend = jest.fn().mockReturnValue(
      new Promise<void>((res) => { resolveRequest = res; }),
    );

    render(
      <FriendsScreen
        token={FAKE_TOKEN}
        onBack={onBack}
        onMessageFriend={onMessageFriend}
      />,
    );

    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy());

    const messageButton = screen.getByRole('button', { name: 'Message Alice' });

    // Press first time
    fireEvent.press(screen.getByText('Message'));

    // Small tick
    await act(async () => { /* flush microtasks */ });

    // Press again while first is pending — the accessible button remains disabled.
    expect(screen.getByRole('button', { name: 'Message Alice' }).props.accessibilityState.disabled).toBe(true);

    // Resolve
    await act(async () => { resolveRequest(); });

    // Should have been called only once
    expect(onMessageFriend).toHaveBeenCalledTimes(1);
  });

  it('opens the Incoming tab when requested by notification navigation', async () => {
    setupDefaultMocks();
    mockGetIncoming.mockResolvedValue({
      items: [{
        requestId: 42,
        user: { userId: 3, displayName: 'Bob' },
        createdAt: '2026-10-05T10:00:00Z',
      }],
    });

    render(
      <FriendsScreen
        token={FAKE_TOKEN}
        onBack={onBack}
        onMessageFriend={jest.fn().mockResolvedValue(undefined)}
        initialTab="incoming"
      />,
    );

    await waitFor(() => expect(screen.getByText('Bob')).toBeTruthy());
    expect(screen.getByRole('tab', { name: /Incoming/ }).props.accessibilityState.selected).toBe(true);
  });
});
