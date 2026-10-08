/**
 * Tests for ConversationsScreen
 *
 * Coverage (PROMPT 015, section 29 — Conversations):
 *  - conversations load successfully
 *  - conversations render (displayName, username)
 *  - empty state works
 *  - API error works
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ConversationsScreen } from '../screens/ConversationsScreen';

// Mock chatApi
jest.mock('../api/chatApi', () => ({
  getConversations: jest.fn(),
}));
jest.mock('../api/groupApi', () => ({ getGroup: jest.fn() }));

import { getConversations } from '../api/chatApi';
import { getGroup } from '../api/groupApi';
import { ApiError } from '../api/client';

const mockGetConversations = getConversations as jest.MockedFunction<typeof getConversations>;
const mockGetGroup = getGroup as jest.MockedFunction<typeof getGroup>;

const FAKE_TOKEN = 'fake-jwt-token';

const makeConversation = (id: number, displayName: string, username: string) => ({
  conversationId: id,
  type: 'DIRECT',
  participant: { userId: id + 100, username, displayName },
  updatedAt: '2024-06-01T10:00:00Z',
  lastMessage: null,
});

describe('ConversationsScreen', () => {
  const onBack = jest.fn();
  const onOpenConversation = jest.fn();
  const onCreateGroup = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGroup.mockResolvedValue({
      groupId: 3,
      name: 'Weekend hikers',
      owner: { userId: 1, username: 'owner', displayName: 'Owner' },
      memberCount: 2,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    });
  });

  // --------------------------------------------------------------------------
  // Loading
  // --------------------------------------------------------------------------
  it('shows a loading indicator while fetching', () => {
    // Never resolve
    mockGetConversations.mockReturnValue(new Promise(() => undefined));

    render(
      <ConversationsScreen
        token={FAKE_TOKEN}
        onBack={onBack}
        onOpenConversation={onOpenConversation}
        onCreateGroup={onCreateGroup}
      />,
    );

    expect(screen.getByText('Loading conversations...')).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // Conversations load successfully
  // --------------------------------------------------------------------------
  it('loads and renders conversations successfully', async () => {
    mockGetConversations.mockResolvedValue({
      items: [
        makeConversation(1, 'Alice Smith', 'alice'),
        makeConversation(2, 'Bob Jones', 'bob'),
      ],
    });

    render(
      <ConversationsScreen
        token={FAKE_TOKEN}
        onBack={onBack}
        onOpenConversation={onOpenConversation}
        onCreateGroup={onCreateGroup}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeTruthy();
    });

    expect(screen.getByText('@alice')).toBeTruthy();
    expect(screen.getByText('Bob Jones')).toBeTruthy();
    expect(screen.getByText('@bob')).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // Empty state
  // --------------------------------------------------------------------------
  it('shows empty state when there are no conversations', async () => {
    mockGetConversations.mockResolvedValue({ items: [] });

    render(
      <ConversationsScreen
        token={FAKE_TOKEN}
        onBack={onBack}
        onOpenConversation={onOpenConversation}
        onCreateGroup={onCreateGroup}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/No conversations yet/i)).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // API error
  // --------------------------------------------------------------------------
  it('shows an error message when the API call fails', async () => {
    mockGetConversations.mockRejectedValue(
      new ApiError('Server error', 'server', 500),
    );

    render(
      <ConversationsScreen
        token={FAKE_TOKEN}
        onBack={onBack}
        onOpenConversation={onOpenConversation}
        onCreateGroup={onCreateGroup}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeTruthy();
    });
  });

  it('shows generic error message for non-ApiError failures', async () => {
    mockGetConversations.mockRejectedValue(new Error('Network down'));

    render(
      <ConversationsScreen
        token={FAKE_TOKEN}
        onBack={onBack}
        onOpenConversation={onOpenConversation}
        onCreateGroup={onCreateGroup}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Unable to load conversations/i)).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // Null token (session expired)
  // --------------------------------------------------------------------------
  it('shows session expired message when token is null', async () => {
    render(
      <ConversationsScreen
        token={null}
        onBack={onBack}
        onOpenConversation={onOpenConversation}
        onCreateGroup={onCreateGroup}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/session has expired/i)).toBeTruthy();
    });
  });

  it('loads group metadata into the existing conversation list', async () => {
    mockGetConversations.mockResolvedValue({
      items: [{
        conversationId: 3,
        type: 'GROUP',
        participant: { userId: 2, username: 'alice', displayName: 'Alice' },
        updatedAt: '2024-06-01T10:00:00Z',
        lastMessage: 'See you soon',
      }],
    });

    render(<ConversationsScreen token={FAKE_TOKEN} onBack={onBack} onOpenConversation={onOpenConversation} onCreateGroup={onCreateGroup} />);

    expect(await screen.findByText('Weekend hikers')).toBeTruthy();
    expect(screen.getByText('See you soon')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /Weekend hikers/ }));
    expect(onOpenConversation).toHaveBeenCalledWith(3);
    expect(mockGetGroup).toHaveBeenCalledWith(3, FAKE_TOKEN);
  });

  it('opens the group creation flow from Conversations', async () => {
    mockGetConversations.mockResolvedValue({ items: [] });
    render(<ConversationsScreen token={FAKE_TOKEN} onBack={onBack} onOpenConversation={onOpenConversation} onCreateGroup={onCreateGroup} />);

    fireEvent.press(screen.getByRole('button', { name: /Group/ }));
    expect(onCreateGroup).toHaveBeenCalledTimes(1);
  });
});
