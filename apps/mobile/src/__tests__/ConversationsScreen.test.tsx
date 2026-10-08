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
import { render, screen, waitFor } from '@testing-library/react-native';
import { ConversationsScreen } from '../screens/ConversationsScreen';

// Mock chatApi
jest.mock('../api/chatApi', () => ({
  getConversations: jest.fn(),
}));

import { getConversations } from '../api/chatApi';
import { ApiError } from '../api/client';

const mockGetConversations = getConversations as jest.MockedFunction<typeof getConversations>;

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

  beforeEach(() => {
    jest.clearAllMocks();
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
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/session has expired/i)).toBeTruthy();
    });
  });
});
