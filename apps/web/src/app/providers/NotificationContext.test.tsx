import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/notifications';
import { AppNotification } from '../../types';
import { NotificationProvider, useNotifications } from './NotificationContext';

const harness = vi.hoisted(() => ({
  auth: null as unknown,
  handlers: null as unknown,
  cleanup: vi.fn(),
}));

vi.mock('./AuthContext', () => ({ useAuth: () => harness.auth }));
vi.mock('../../services/chatWebSocket', () => ({
  subscribeToNotifications: vi.fn((_token: string, handlers: unknown) => {
    harness.handlers = handlers;
    return harness.cleanup;
  }),
}));
vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));

const notification: AppNotification = {
  id: 3,
  recipientId: 9,
  type: 'NEW_MESSAGE',
  title: 'New message',
  message: 'A message arrived.',
  referenceType: 'MESSAGE',
  referenceId: 21,
  conversationId: 42,
  read: false,
  createdAt: '2026-10-06T12:00:00Z',
  readAt: null,
};

type NotificationHandlers = {
  onNotification: (item: AppNotification) => void;
  onStateChange: (state: 'connecting' | 'connected' | 'reconnecting') => void;
};

function setAuthenticated(token: string | null = 'jwt') {
  harness.auth = {
    user: token ? { id: 9, username: 'mira', displayName: 'Mira' } : null,
    token,
    isLoading: false,
  };
}

function Probe() {
  const state = useNotifications();
  return (
    <div>
      <output data-testid="count">{state.unreadCount}</output>
      <output data-testid="ids">{state.notifications.map((item) => `${item.id}:${item.read}`).join(',')}</output>
      <button type="button" onClick={() => void state.loadNotifications()}>Load list</button>
      <button type="button" onClick={() => void state.loadNotifications(true)}>Refresh list</button>
      <button type="button" onClick={() => void state.markAsRead(notification.id)}>Mark one</button>
      <button type="button" onClick={() => void state.markAllAsRead()}>Mark all</button>
    </div>
  );
}

function renderProvider() {
  return render(<NotificationProvider><Probe /></NotificationProvider>);
}

describe('notification provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthenticated();
    harness.handlers = null;
    getUnreadNotificationCount.mockResolvedValue({ unreadCount: 2 });
    getNotifications.mockResolvedValue({
      items: [notification], unreadCount: 1, total: 1, limit: 20, offset: 0, hasMore: false,
    });
    markNotificationRead.mockResolvedValue({ ...notification, read: true, readAt: '2026-10-06T12:01:00Z' });
    markAllNotificationsRead.mockResolvedValue({
      items: [{ ...notification, read: true, readAt: '2026-10-06T12:01:00Z' }],
      unreadCount: 0,
      total: 1,
      limit: 50,
      offset: 0,
      hasMore: false,
    });
  });

  it('loads the badge after authentication and deduplicates realtime events', async () => {
    getUnreadNotificationCount.mockResolvedValueOnce({ unreadCount: 2 }).mockResolvedValue({ unreadCount: 3 });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
    const handlers = harness.handlers as NotificationHandlers;

    await act(async () => handlers.onNotification(notification));
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('3'));
    await act(async () => handlers.onNotification(notification));
    await act(async () => handlers.onNotification({ ...notification, id: 4, recipientId: 10 }));

    expect(screen.getByTestId('count').textContent).toBe('3');
    expect(screen.getByTestId('ids').textContent).toBe('3:false');
    expect(getUnreadNotificationCount).toHaveBeenCalledTimes(2);
  });

  it('refreshes the authoritative count after reconnect', async () => {
    renderProvider();
    const handlers = harness.handlers as NotificationHandlers;
    await waitFor(() => expect(getUnreadNotificationCount).toHaveBeenCalledOnce());
    act(() => handlers.onStateChange('reconnecting'));
    act(() => handlers.onStateChange('connected'));

    await waitFor(() => expect(getUnreadNotificationCount).toHaveBeenCalledTimes(2));
  });

  it('updates individual and bulk read state without going below zero', async () => {
    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'Load list' }));
    await waitFor(() => expect(screen.getByTestId('ids').textContent).toBe('3:false'));
    fireEvent.click(screen.getByRole('button', { name: 'Mark one' }));
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    expect(screen.getByTestId('ids').textContent).toBe('3:true');

    fireEvent.click(screen.getByRole('button', { name: 'Mark all' }));
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
    expect(screen.getByTestId('ids').textContent).toBe('3:true');
  });

  it('does not let a stale REST list count overwrite a completed mark-read action', async () => {
    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'Load list' }));
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));

    let resolveRefresh: ((response: Awaited<ReturnType<typeof getNotifications>>) => void) | undefined;
    getNotifications.mockReturnValueOnce(new Promise((resolve) => { resolveRefresh = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark one' }));
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));

    await act(async () => resolveRefresh?.({
      items: [notification], unreadCount: 1, total: 1, limit: 20, offset: 0, hasMore: false,
    }));
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('clears the prior user state and subscription on logout', async () => {
    const view = renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'Load list' }));
    await waitFor(() => expect(screen.getByTestId('ids').textContent).toBe('3:false'));

    setAuthenticated(null);
    view.rerender(<NotificationProvider><Probe /></NotificationProvider>);

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
    expect(screen.getByTestId('ids').textContent).toBe('');
    expect(harness.cleanup).toHaveBeenCalledOnce();
  });
});