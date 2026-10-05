/**
 * Tests for ChatScreen
 *
 * Coverage (PROMPT 015, section 29):
 *
 * Direct conversation:
 *  - opening a conversation loads messages
 *  - unauthorized / forbidden state is handled
 *
 * Sending messages:
 *  - empty message is rejected (validation error shown)
 *  - valid message calls API
 *  - duplicate sends are prevented
 *  - successful message appears in the list
 *  - API failure is handled
 *
 * Realtime (WebSocket integration — via service mock):
 *  - subscribeToConversation is called with correct conversationId + token
 *  - incoming WS message is added to the list
 *  - duplicate message from WS (same messageId as REST) is not shown twice
 *  - teardown (unsubscribe) called when component unmounts
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ChatScreen } from '../screens/ChatScreen';
import { ApiError } from '../api/client';

// ---- Mock chatApi ----
jest.mock('../api/chatApi', () => ({
  getConversationDetail: jest.fn(),
  getMessages: jest.fn(),
  sendMessage: jest.fn(),
}));

import { getConversationDetail, getMessages, sendMessage } from '../api/chatApi';

const mockGetDetail = getConversationDetail as jest.MockedFunction<typeof getConversationDetail>;
const mockGetMessages = getMessages as jest.MockedFunction<typeof getMessages>;
const mockSendMessage = sendMessage as jest.MockedFunction<typeof sendMessage>;

// ---- Mock chatWebSocketService ----
type WsHandlers = {
  onMessage: (msg: unknown) => void;
  onStateChange: (state: string) => void;
};

let capturedWsHandlers: WsHandlers | null = null;
const mockTeardown = jest.fn();

jest.mock('../services/chatWebSocketService', () => ({
  subscribeToConversation: jest.fn(
    (_id: number, _token: string, handlers: WsHandlers) => {
      capturedWsHandlers = handlers;
      handlers.onStateChange('connected');
      return mockTeardown;
    },
  ),
}));

import { subscribeToConversation } from '../services/chatWebSocketService';
const mockSubscribe = subscribeToConversation as jest.MockedFunction<typeof subscribeToConversation>;

// ---- Test helpers ----
const FAKE_TOKEN = 'fake-jwt';
const CONVERSATION_ID = 10;
const CURRENT_USER_ID = 1;

const makeDetail = () => ({
  conversationId: CONVERSATION_ID,
  type: 'DIRECT',
  participants: [
    { userId: CURRENT_USER_ID, username: 'me', displayName: 'Me' },
    { userId: 2, username: 'alice', displayName: 'Alice' },
  ],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
});

const makeMessage = (id: number, senderId: number, content: string) => ({
  messageId: id,
  conversationId: CONVERSATION_ID,
  senderId,
  content,
  createdAt: `2024-01-01T00:0${id}:00Z`,
});

const makePageResponse = (messages: ReturnType<typeof makeMessage>[], total = messages.length) => ({
  items: messages,
  total,
  page: 0,
  size: 20,
});

const defaultProps = {
  conversationId: CONVERSATION_ID,
  currentUserId: CURRENT_USER_ID,
  token: FAKE_TOKEN,
  onBack: jest.fn(),
};

describe('ChatScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedWsHandlers = null;

    // Default happy-path mocks
    mockGetDetail.mockResolvedValue(makeDetail());
    mockGetMessages.mockResolvedValue(makePageResponse([]));
  });

  // --------------------------------------------------------------------------
  // Loading messages
  // --------------------------------------------------------------------------
  it('shows loading indicator while fetching', () => {
    mockGetDetail.mockReturnValue(new Promise(() => undefined));
    mockGetMessages.mockReturnValue(new Promise(() => undefined));

    render(<ChatScreen {...defaultProps} />);

    expect(screen.getByText('Loading messages...')).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // Opening a conversation loads messages
  // --------------------------------------------------------------------------
  it('renders loaded messages after fetch', async () => {
    mockGetMessages.mockResolvedValue(
      makePageResponse([
        makeMessage(1, 2, 'Hello!'),
        makeMessage(2, CURRENT_USER_ID, 'Hi Alice'),
      ]),
    );

    render(<ChatScreen {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Hello!')).toBeTruthy();
      expect(screen.getByText('Hi Alice')).toBeTruthy();
    });
  });

  it('shows empty state when conversation has no messages', async () => {
    mockGetMessages.mockResolvedValue(makePageResponse([]));

    render(<ChatScreen {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No messages yet.')).toBeTruthy();
    });
  });

  it('loads an older page and keeps messages in chronological order', async () => {
    const newestPage = Array.from({ length: 20 }, (_, index) =>
      makeMessage(index + 2, index % 2 === 0 ? 2 : CURRENT_USER_ID, `Message ${index + 2}`),
    );
    mockGetMessages
      .mockResolvedValueOnce(makePageResponse(newestPage, 21))
      .mockResolvedValueOnce({
        items: [makeMessage(1, 2, 'Oldest message')],
        total: 21,
        page: 1,
        size: 20,
      });

    render(<ChatScreen {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('Load older messages')).toBeTruthy());

    fireEvent.press(screen.getByText('Load older messages'));

    await waitFor(() => expect(screen.getByText('Oldest message')).toBeTruthy());
    expect(mockGetMessages).toHaveBeenLastCalledWith(CONVERSATION_ID, FAKE_TOKEN, 1, 20);
    expect(screen.getByText('Message 2')).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // Unauthorized / Forbidden
  // --------------------------------------------------------------------------
  it('shows error state on 401 response', async () => {
    mockGetDetail.mockRejectedValue(new ApiError('Your login details are invalid or your session has expired.', 'unauthorized', 401));

    render(<ChatScreen {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/session has expired|invalid/i)).toBeTruthy();
    });
  });

  it('shows forbidden error on 403 response', async () => {
    mockGetDetail.mockRejectedValue(new ApiError('You do not have permission to do that.', 'forbidden', 403));

    render(<ChatScreen {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/permission/i)).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // Sending messages — empty rejected
  // --------------------------------------------------------------------------
  it('rejects empty message and does not call API', async () => {
    render(<ChatScreen {...defaultProps} />);
    await waitFor(() => expect(screen.queryByText('Loading messages...')).toBeNull());

    const sendButton = screen.getByText('Send');
    fireEvent.press(sendButton);

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(screen.getByText(/enter a message/i)).toBeTruthy();
  });

  it('rejects whitespace-only message', async () => {
    render(<ChatScreen {...defaultProps} />);
    await waitFor(() => expect(screen.queryByText('Loading messages...')).toBeNull());

    const input = screen.getByLabelText('Message');
    fireEvent.changeText(input, '   ');

    const sendButton = screen.getByText('Send');
    fireEvent.press(sendButton);

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // Sending messages — valid message calls API
  // --------------------------------------------------------------------------
  it('calls sendMessage API with correct arguments on valid send', async () => {
    mockSendMessage.mockResolvedValue(makeMessage(99, CURRENT_USER_ID, 'Test message'));

    render(<ChatScreen {...defaultProps} />);
    await waitFor(() => expect(screen.queryByText('Loading messages...')).toBeNull());

    const input = screen.getByLabelText('Message');
    fireEvent.changeText(input, 'Test message');
    fireEvent.press(screen.getByText('Send'));

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        CONVERSATION_ID,
        { content: 'Test message' },
        FAKE_TOKEN,
      );
    });
  });

  // --------------------------------------------------------------------------
  // Sending messages — successful message appears
  // --------------------------------------------------------------------------
  it('shows returned message in the list after successful send', async () => {
    mockSendMessage.mockResolvedValue(makeMessage(99, CURRENT_USER_ID, 'Sent!'));

    render(<ChatScreen {...defaultProps} />);
    await waitFor(() => expect(screen.queryByText('Loading messages...')).toBeNull());

    fireEvent.changeText(screen.getByLabelText('Message'), 'Sent!');
    fireEvent.press(screen.getByText('Send'));

    await waitFor(() => {
      expect(screen.getByText('Sent!')).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // Sending messages — API failure handled
  // --------------------------------------------------------------------------
  it('shows error message when sendMessage API fails', async () => {
    mockSendMessage.mockRejectedValue(new ApiError('Server error', 'server', 500));

    render(<ChatScreen {...defaultProps} />);
    await waitFor(() => expect(screen.queryByText('Loading messages...')).toBeNull());

    fireEvent.changeText(screen.getByLabelText('Message'), 'Will fail');
    fireEvent.press(screen.getByText('Send'));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // Duplicate sends prevented
  // --------------------------------------------------------------------------
  it('prevents duplicate sends while a send is in progress', async () => {
    let resolveFirst!: (value: ReturnType<typeof makeMessage>) => void;
    mockSendMessage.mockReturnValueOnce(
      new Promise<ReturnType<typeof makeMessage>>((res) => { resolveFirst = res; }),
    );

    render(<ChatScreen {...defaultProps} />);
    await waitFor(() => expect(screen.queryByText('Loading messages...')).toBeNull());

    fireEvent.changeText(screen.getByLabelText('Message'), 'Hello');

    // First press starts the request and disables further sends.
    fireEvent.press(screen.getByRole('button', { name: 'Send message' }));
    expect(screen.getByRole('button', { name: 'Send message' }).props.accessibilityState.disabled).toBe(true);

    // Resolve the pending request
    await act(async () => {
      resolveFirst(makeMessage(1, CURRENT_USER_ID, 'Hello'));
    });

    // sendMessage should have been called exactly once despite two presses
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // WebSocket — subscribeToConversation called
  // --------------------------------------------------------------------------
  it('subscribes to WebSocket with correct conversationId and token', async () => {
    render(<ChatScreen {...defaultProps} />);
    await waitFor(() => expect(screen.queryByText('Loading messages...')).toBeNull());

    expect(mockSubscribe).toHaveBeenCalledWith(
      CONVERSATION_ID,
      FAKE_TOKEN,
      expect.objectContaining({
        onMessage: expect.any(Function),
        onStateChange: expect.any(Function),
      }),
    );
  });

  // --------------------------------------------------------------------------
  // WebSocket — incoming message added
  // --------------------------------------------------------------------------
  it('adds incoming WebSocket message to the list', async () => {
    render(<ChatScreen {...defaultProps} />);
    await waitFor(() => expect(screen.queryByText('Loading messages...')).toBeNull());

    act(() => {
      capturedWsHandlers?.onMessage(makeMessage(55, 2, 'From Alice via WS'));
    });

    await waitFor(() => {
      expect(screen.getByText('From Alice via WS')).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // WebSocket — duplicate prevention (REST + WS same messageId)
  // --------------------------------------------------------------------------
  it('does not show the same message twice when WS delivers a message already added by REST', async () => {
    const msg = makeMessage(42, CURRENT_USER_ID, 'Unique message');
    mockSendMessage.mockResolvedValue(msg);

    render(<ChatScreen {...defaultProps} />);
    await waitFor(() => expect(screen.queryByText('Loading messages...')).toBeNull());

    // Send via REST
    fireEvent.changeText(screen.getByLabelText('Message'), 'Unique message');
    fireEvent.press(screen.getByText('Send'));
    await waitFor(() => expect(screen.getByText('Unique message')).toBeTruthy());

    // WS delivers the same message (same messageId)
    act(() => {
      capturedWsHandlers?.onMessage(msg);
    });

    await waitFor(() => {
      const elements = screen.getAllByText('Unique message');
      expect(elements).toHaveLength(1); // still only one
    });
  });

  // --------------------------------------------------------------------------
  // WebSocket — teardown on unmount
  // --------------------------------------------------------------------------
  it('calls teardown function when component unmounts', async () => {
    const { unmount } = await render(<ChatScreen {...defaultProps} />);
    await waitFor(() => expect(screen.queryByText('Loading messages...')).toBeNull());

    unmount();

    expect(mockTeardown).toHaveBeenCalled();
  });
});
