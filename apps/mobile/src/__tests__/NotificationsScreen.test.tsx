import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '../api/client';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notificationApi';
import { AppNotification } from '../types/notification';

jest.mock('../api/notificationApi', () => ({
  getNotifications: jest.fn(),
  getUnreadNotificationCount: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  markNotificationRead: jest.fn(),
}));

const mockGetNotifications = getNotifications as jest.MockedFunction<typeof getNotifications>;
const mockGetUnreadCount = getUnreadNotificationCount as jest.MockedFunction<typeof getUnreadNotificationCount>;
const mockMarkAllRead = markAllNotificationsRead as jest.MockedFunction<typeof markAllNotificationsRead>;
const mockMarkRead = markNotificationRead as jest.MockedFunction<typeof markNotificationRead>;

const token = 'test-jwt';

function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 7,
    recipientId: 2,
    type: 'FRIEND_REQUEST_RECEIVED',
    title: 'Friend request',
    message: 'Alice sent you a friend request.',
    referenceType: 'FRIEND_REQUEST',
    referenceId: 42,
    conversationId: null,
    read: false,
    createdAt: new Date().toISOString(),
    readAt: null,
    ...overrides,
  };
}

function makeProps() {
  return {
    token,
    onBack: jest.fn(),
    onUnreadCountChange: jest.fn(),
    onOpenFriends: jest.fn(),
  };
}

function setupDefaults(items: AppNotification[] = [makeNotification()]) {
  mockGetNotifications.mockResolvedValue({
    items,
    unreadCount: items.filter((item) => !item.read).length,
    total: items.length,
    limit: 20,
    offset: 0,
    hasMore: false,
  });
  mockGetUnreadCount.mockResolvedValue({ unreadCount: items.filter((item) => !item.read).length });
  mockMarkRead.mockImplementation(async (id) => makeNotification({ id, read: true, readAt: new Date().toISOString() }));
  mockMarkAllRead.mockResolvedValue({
    items: items.map((item) => ({ ...item, read: true, readAt: new Date().toISOString() })),
    unreadCount: 0,
  });
}

describe('NotificationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaults();
  });

  it('shows loading state while loading notifications', () => {
    mockGetNotifications.mockReturnValue(new Promise(() => undefined));
    mockGetUnreadCount.mockReturnValue(new Promise(() => undefined));

    render(<NotificationsScreen {...makeProps()} />);

    expect(screen.getByText('Loading notifications...')).toBeTruthy();
  });

  it('renders notification content, read state, and unread count', async () => {
    const readNotification = makeNotification({
      id: 8,
      type: 'FRIEND_REQUEST_ACCEPTED',
      title: 'Friend request accepted',
      message: 'Bob accepted your friend request.',
      read: true,
      readAt: new Date().toISOString(),
    });
    setupDefaults([makeNotification(), readNotification]);

    render(<NotificationsScreen {...makeProps()} />);

    await waitFor(() => expect(screen.getByText('1 unread')).toBeTruthy());
    expect(screen.getByText('Alice sent you a friend request.')).toBeTruthy();
    expect(screen.getByText('Bob accepted your friend request.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Unread/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Read/ })).toBeTruthy();
  });

  it('shows an empty state for an empty list', async () => {
    setupDefaults([]);

    render(<NotificationsScreen {...makeProps()} />);

    await waitFor(() => expect(screen.getByText('No notifications yet.')).toBeTruthy());
  });

  it('deduplicates repeated notifications by backend ID', async () => {
    const notification = makeNotification();
    setupDefaults([notification, notification]);

    render(<NotificationsScreen {...makeProps()} />);

    await waitFor(() => expect(screen.getByText('2 unread')).toBeTruthy());
    expect(screen.getAllByRole('button', { name: /Alice sent you a friend request/ })).toHaveLength(1);
  });

  it('loads older notifications using the next bounded offset', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => makeNotification({ id: index + 1 }));
    const olderNotification = makeNotification({ id: 21, read: true, message: 'Bob accepted your friend request.' });
    mockGetNotifications
      .mockResolvedValueOnce({ items: firstPage, unreadCount: 20, total: 21, limit: 20, offset: 0, hasMore: true })
      .mockResolvedValueOnce({ items: [olderNotification], unreadCount: 20, total: 21, limit: 20, offset: 20, hasMore: false });
    render(<NotificationsScreen {...makeProps()} />);

    fireEvent.press(await screen.findByRole('button', { name: 'Load older notifications' }));
    await waitFor(() => expect(mockGetNotifications).toHaveBeenCalledTimes(2));

    expect(mockGetNotifications).toHaveBeenNthCalledWith(2, token, 20, 20);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Load older notifications' })).toBeNull());
  });

  it('shows a retryable error state when loading fails', async () => {
    mockGetNotifications.mockRejectedValue(new ApiError('Unable to connect.', 'network'));

    render(<NotificationsScreen {...makeProps()} />);

    await waitFor(() => expect(screen.getByText('Unable to connect.')).toBeTruthy());
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('marks an unread notification as read, updates the count, and opens incoming requests', async () => {
    const props = makeProps();
    const notification = makeNotification();
    render(<NotificationsScreen {...props} />);

    const row = await screen.findByRole('button', { name: /Alice sent you a friend request.*Unread/ });
    fireEvent.press(row);

    await waitFor(() => {
      expect(mockMarkRead).toHaveBeenCalledWith(notification.id, token);
      expect(screen.getByRole('button', { name: /Read/ })).toBeTruthy();
      expect(screen.getByText('0 unread')).toBeTruthy();
      expect(props.onUnreadCountChange).toHaveBeenLastCalledWith(0);
      expect(props.onOpenFriends).toHaveBeenCalledWith('incoming');
    });
  });

  it('opens Friends for an accepted request without marking an already-read item again', async () => {
    const props = makeProps();
    setupDefaults([makeNotification({
      type: 'FRIEND_REQUEST_ACCEPTED',
      title: 'Friend request accepted',
      message: 'Bob accepted your friend request.',
      read: true,
      readAt: new Date().toISOString(),
    })]);
    render(<NotificationsScreen {...props} />);

    fireEvent.press(await screen.findByRole('button', { name: /Bob accepted.*Read/ }));

    expect(mockMarkRead).not.toHaveBeenCalled();
    expect(props.onOpenFriends).toHaveBeenCalledWith('friends');
  });

  it('keeps an item unread and does not navigate when mark-read fails', async () => {
    const props = makeProps();
    mockMarkRead.mockRejectedValue(new ApiError('Unable to connect.', 'network'));
    render(<NotificationsScreen {...props} />);

    fireEvent.press(await screen.findByRole('button', { name: /Unread/ }));

    await waitFor(() => expect(screen.getByText('Unable to connect.')).toBeTruthy());
    expect(screen.getByText('1 unread')).toBeTruthy();
    expect(props.onUnreadCountChange).toHaveBeenLastCalledWith(1);
    expect(props.onOpenFriends).not.toHaveBeenCalled();
  });

  it('marks message notifications read without treating a message ID as a conversation ID', async () => {
    const props = makeProps();
    setupDefaults([makeNotification({ type: 'NEW_MESSAGE', referenceType: 'MESSAGE', referenceId: 99 })]);
    render(<NotificationsScreen {...props} />);

    fireEvent.press(await screen.findByRole('button', { name: /Unread/ }));

    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith(7, token));
    expect(props.onOpenFriends).not.toHaveBeenCalled();
  });

  it('does not navigate when the notification reference is invalid', async () => {
    const props = makeProps();
    setupDefaults([makeNotification({ referenceId: 0 })]);
    render(<NotificationsScreen {...props} />);

    fireEvent.press(await screen.findByRole('button', { name: /Unread/ }));

    await waitFor(() => expect(mockMarkRead).toHaveBeenCalled());
    expect(props.onOpenFriends).not.toHaveBeenCalled();
  });

  it('marks all notifications read and sets the unread count to zero', async () => {
    const props = makeProps();
    render(<NotificationsScreen {...props} />);

    await screen.findByText('1 unread');
    fireEvent.press(screen.getByText('Mark all as read'));

    await waitFor(() => {
      expect(mockMarkAllRead).toHaveBeenCalledWith(token);
      expect(screen.getByText('0 unread')).toBeTruthy();
      expect(screen.getByRole('button', { name: /Read/ })).toBeTruthy();
      expect(props.onUnreadCountChange).toHaveBeenLastCalledWith(0);
    });
  });

  it('keeps unread state and count when marking all fails', async () => {
    mockMarkAllRead.mockRejectedValue(new ApiError('Unable to connect.', 'network'));
    render(<NotificationsScreen {...makeProps()} />);

    await screen.findByText('1 unread');
    fireEvent.press(screen.getByText('Mark all as read'));

    await waitFor(() => expect(screen.getByText('Unable to connect.')).toBeTruthy());
    expect(screen.getByText('1 unread')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Unread/ })).toBeTruthy();
  });

  it('prevents duplicate mark-read requests while one is pending', async () => {
    const props = makeProps();
    let resolveRead!: (notification: AppNotification) => void;
    mockMarkRead.mockReturnValue(new Promise((resolve) => { resolveRead = resolve; }));
    render(<NotificationsScreen {...props} />);

    const row = await screen.findByRole('button', { name: /Unread/ });
    fireEvent.press(row);
    fireEvent.press(row);

    expect(mockMarkRead).toHaveBeenCalledTimes(1);
    await act(async () => resolveRead(makeNotification({ read: true, readAt: new Date().toISOString() })));
  });
});
