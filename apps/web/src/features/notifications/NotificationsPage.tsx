import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { useNotifications } from '../../app/providers/NotificationContext';
import { AppNotification } from '../../types';

export function NotificationsPage() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    loadingMore,
    markingAll,
    hasMore,
    error,
    connectionState,
    loadNotifications,
    loadMore,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const openNotification = async (notification: AppNotification) => {
    if (busyId !== null || markingAll) return;
    setActionError('');
    setBusyId(notification.id);
    try {
      if (!notification.read) await markAsRead(notification.id);
      const destination = getNotificationDestination(notification);
      if (destination) navigate(destination);
    } catch (markError) {
      setActionError(markError instanceof ApiError ? markError.message : 'Unable to mark this notification as read.');
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAll = async () => {
    setActionError('');
    try {
      await markAllAsRead();
    } catch (markError) {
      setActionError(markError instanceof ApiError ? markError.message : 'Unable to mark notifications as read.');
    }
  };

  return (
    <section className="page-content notifications-page">
      <div className="page-heading notification-heading">
        <div>
          <p className="eyebrow">YOUR ACTIVITY</p>
          <h1>Notifications</h1>
          <p className="notification-summary" aria-live="polite">
            {unreadCount} unread
          </p>
        </div>
        <div className="notification-actions">
          <span className={`connection-state ${connectionState === 'connected' ? 'connected' : ''}`} role="status">
            <i />{connectionState === 'connected' ? 'Live updates on' : connectionState === 'reconnecting' ? 'Reconnecting' : 'Connecting'}
          </span>
          <button className="quiet-light-button" type="button" onClick={() => void loadNotifications(true)} disabled={loading}>
            Refresh
          </button>
          <button className="primary-button compact-button" type="button" onClick={() => void handleMarkAll()}
            disabled={markingAll || busyId !== null || unreadCount === 0}>
            {markingAll ? 'Marking...' : 'Mark all as read'}
          </button>
        </div>
      </div>

      {error || actionError ? <p className="inline-error" role="alert">{actionError || error}</p> : null}

      {loading && notifications.length === 0 ? (
        <div className="result-state" role="status"><span className="spinner" /> Loading notifications...</div>
      ) : error && notifications.length === 0 ? (
        <div className="result-state empty-state notification-empty">
          Notifications could not be loaded.
          <button className="quiet-light-button" type="button" onClick={() => void loadNotifications(true)}>Try again</button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="result-state empty-state notification-empty">You're all caught up.</div>
      ) : (
        <>
          <div className="notification-list" role="list" aria-label="Your notifications">
            {notifications.map((notification) => (
              <div className={`notification-row ${notification.read ? 'is-read' : 'is-unread'}`} role="listitem" key={notification.id}>
                <button type="button" className="notification-open" onClick={() => void openNotification(notification)}
                  disabled={busyId === notification.id || markingAll}
                  aria-label={`${notification.read ? 'Read' : 'Unread'} notification: ${notification.title}`}>
                  <span className="notification-indicator" aria-hidden="true" />
                  <span className="notification-copy">
                    <strong>{notification.title}</strong>
                    <span>{notification.message}</span>
                    <time dateTime={notification.createdAt}>{formatNotificationTime(notification.createdAt)}</time>
                  </span>
                  <span className="notification-arrow" aria-hidden="true">→</span>
                </button>
              </div>
            ))}
          </div>
          {hasMore ? (
            <div className="notification-more">
              <button className="quiet-light-button" type="button" onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? 'Loading...' : 'Load older notifications'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

export function getNotificationDestination(notification: AppNotification) {
  switch (notification.type) {
    case 'FRIEND_REQUEST_RECEIVED':
      return '/app/friends?tab=incoming';
    case 'FRIEND_REQUEST_ACCEPTED':
      return '/app/friends';
    case 'NEW_MESSAGE':
      return Number.isSafeInteger(notification.conversationId) && Number(notification.conversationId) > 0
        ? `/app/chat/${notification.conversationId}`
        : '/app/chat';
  }
}

function formatNotificationTime(value: string) {
  const createdAt = Date.parse(value);
  const minutes = Math.max(0, Math.floor((Date.now() - createdAt) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(createdAt);
}