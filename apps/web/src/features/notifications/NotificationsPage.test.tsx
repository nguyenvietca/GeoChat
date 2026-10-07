import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
import { useNotifications } from '../../app/providers/NotificationContext';
import { AppNotification } from '../../types';
import { getNotificationDestination, NotificationsPage } from './NotificationsPage';

vi.mock('../../app/providers/NotificationContext', () => ({ useNotifications: vi.fn() }));
const mockUseNotifications = vi.mocked(useNotifications);

const unreadRequest: AppNotification = {
  id: 1,
  recipientId: 9,
  type: 'FRIEND_REQUEST_RECEIVED',
  title: 'Friend request',
  message: 'Mira sent you a friend request.',
  referenceType: 'FRIEND_REQUEST',
  referenceId: 44,
  conversationId: null,
  read: false,
  createdAt: '2026-10-06T12:00:00Z',
  readAt: null,
};

function createState(overrides: Partial<ReturnType<typeof useNotifications>> = {}) {
  return {
    notifications: [unreadRequest],
    unreadCount: 1,
    loading: false,
    loadingMore: false,
    markingAll: false,
    hasMore: false,
    error: '',
    connectionState: 'connected' as const,
    loadNotifications: vi.fn().mockResolvedValue(undefined),
    loadMore: vi.fn().mockResolvedValue(undefined),
    refreshUnreadCount: vi.fn().mockResolvedValue(undefined),
    markAsRead: vi.fn().mockResolvedValue(undefined),
    markAllAsRead: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as ReturnType<typeof useNotifications>;
}

function PathProbe() {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname}{location.search}</output>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/app/notifications']}>
      <Routes>
        <Route path="/app/notifications" element={<NotificationsPage />} />
        <Route path="/app/friends" element={<PathProbe />} />
        <Route path="/app/chat" element={<PathProbe />} />
        <Route path="/app/chat/:conversationId" element={<PathProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('notifications page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows read/unread notifications and loads the persisted page on entry', () => {
    mockUseNotifications.mockReturnValue(createState({
      notifications: [unreadRequest, { ...unreadRequest, id: 2, read: true, title: 'Accepted request' }],
      unreadCount: 1,
    }));
    renderPage();

    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unread notification: Friend request' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Read notification: Accepted request' })).toBeTruthy();
    expect(mockUseNotifications.mock.results[0].value.loadNotifications).toHaveBeenCalledOnce();
  });

  it('marks an unread notification as read before navigating to incoming requests', async () => {
    const state = createState();
    mockUseNotifications.mockReturnValue(state);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Unread notification: Friend request' }));

    expect((await screen.findByLabelText('Current route')).textContent).toBe('/app/friends?tab=incoming');
    expect(state.markAsRead).toHaveBeenCalledWith(unreadRequest.id);
  });

  it('does not navigate when marking a notification read fails', async () => {
    const state = createState({ markAsRead: vi.fn().mockRejectedValue(new ApiError('Could not mark as read.')) });
    mockUseNotifications.mockReturnValue(state);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Unread notification: Friend request' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Could not mark as read.');
    expect(screen.queryByLabelText('Current route')).toBeNull();
  });

  it('supports mark-all, loading, empty, and error states', async () => {
    const state = createState({ hasMore: true });
    mockUseNotifications.mockReturnValue(state);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    expect(state.markAllAsRead).toHaveBeenCalledOnce();

    mockUseNotifications.mockReturnValue(createState({ notifications: [], unreadCount: 0, loading: true }));
    renderPage();
    expect(screen.getByText('Loading notifications...')).toBeTruthy();

    mockUseNotifications.mockReturnValue(createState({ notifications: [], unreadCount: 0, error: 'Notifications unavailable.' }));
    renderPage();
    expect(screen.queryByText("You're all caught up.")).toBeNull();
    expect(screen.getByText('Notifications could not be loaded.')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Notifications unavailable.');
  });

  it('navigates by notification type using actual resource references', () => {
    expect(getNotificationDestination(unreadRequest)).toBe('/app/friends?tab=incoming');
    expect(getNotificationDestination({ ...unreadRequest, type: 'FRIEND_REQUEST_ACCEPTED' })).toBe('/app/friends');
    expect(getNotificationDestination({ ...unreadRequest, type: 'NEW_MESSAGE', conversationId: 88 }))
      .toBe('/app/chat/88');
    expect(getNotificationDestination({ ...unreadRequest, type: 'NEW_MESSAGE', conversationId: null }))
      .toBe('/app/chat');
  });
});