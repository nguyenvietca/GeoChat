import { useEffect, useRef, useState } from 'react';
import { useLocale, translate as t } from '../../i18n';
import { Link, useNavigate } from 'react-router-dom';
import { useNotifications } from '../../app/providers/NotificationContext';
import { getNotificationDestination } from './NotificationsPage';

export function NotificationBellIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>;
}

export function NotificationBell() {
  useLocale();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, error, markingAll, loadNotifications, markAsRead, markAllAsRead } = useNotifications();

  useEffect(() => {
    if (open) void loadNotifications();
  }, [loadNotifications, open]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return <div className="notification-bell-wrap" ref={root}>
    <button type="button" className="notification-bell" aria-label={t('notifications.bellLabel', { count: unreadCount })}
      aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((value) => !value)}>
      <NotificationBellIcon />{unreadCount > 0 ? <b>{unreadCount > 99 ? '99+' : unreadCount}</b> : null}
    </button>
    {open ? <section className="notification-panel" role="dialog" aria-label={t('common.notifications')}>
      <header><strong>{t('common.notifications')}</strong><button type="button" disabled={markingAll || unreadCount === 0}
        onClick={() => void markAllAsRead()}>{t('notifications.markAll')}</button></header>
      {loading && notifications.length === 0 ? <p role="status">{t('notifications.loading')}</p> : null}
      {error && notifications.length === 0 ? <p role="alert">{t('notifications.loadFailed')}</p> : null}
      {!loading && !error && notifications.length === 0 ? <p>{t('notifications.caughtUp')}</p> : null}
      <div className="notification-panel-list">
        {notifications.slice(0, 6).map((item) => <button type="button" key={item.id} className={item.read ? 'is-read' : 'is-unread'}
          onClick={async () => { if (!item.read) await markAsRead(item.id); setOpen(false); navigate(getNotificationDestination(item) ?? '/app/notifications'); }}>
          <i aria-hidden="true">{item.type === 'NEW_MESSAGE' ? '✉' : item.type === 'FRIEND_REQUEST_RECEIVED' ? '+' : '✓'}</i>
          <span><strong>{item.title}</strong><small>{item.message}</small></span>
        </button>)}
      </div>
      <Link to="/app/notifications" onClick={() => setOpen(false)}>{t('notifications.viewAll')}</Link>
    </section> : null}
  </div>;
}
