import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getNotificationPreferences, getNotifications, getUnreadNotificationCount, markAllNotificationsRead, markNotificationRead, updateNotificationPreferences } from '../../api/notifications';
import { AppNotification, NotificationListResponse, NotificationPreferences } from '../../types';
import { useAuth } from './AuthContext';
import { ChatConnectionState, subscribeToConversationRead, subscribeToNotifications } from '../../services/chatWebSocket';

const PAGE_SIZE = 20;

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  loadingMore: boolean;
  markingAll: boolean;
  hasMore: boolean;
  error: string;
  connectionState: ChatConnectionState;
  loadNotifications: (refresh?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  preferences: NotificationPreferences;
  updatePreferences: (preferences: NotificationPreferences) => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, token, isLoading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [connectionState, setConnectionState] = useState<ChatConnectionState>('connecting');
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const preferencesRef = useRef<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const notificationsRef = useRef<AppNotification[]>([]);
  const unreadCountRef = useRef(0);
  const loadedRef = useRef(false);
  const nextOffsetRef = useRef(0);
  const notificationChangeVersionRef = useRef(0);
  const markingIdsRef = useRef(new Set<number>());
  const markingAllRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const updatePreferences = useCallback(async (next: NotificationPreferences) => {
    if (!token) return;
    const saved = await updateNotificationPreferences(next, token);
    preferencesRef.current = saved;
    setPreferences(saved);
    channelRef.current?.postMessage({ type: 'changed' });
  }, [token]);

  const replaceNotifications = useCallback((items: AppNotification[]) => {
    notificationsRef.current = items;
    setNotifications(items);
  }, []);

  const replaceUnreadCount = useCallback((count: number) => {
    const safeCount = Math.max(0, count);
    unreadCountRef.current = safeCount;
    setUnreadCount(safeCount);
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!token) return;
    const changeVersion = notificationChangeVersionRef.current;
    const response = await getUnreadNotificationCount(token);
    if (changeVersion === notificationChangeVersionRef.current) {
      replaceUnreadCount(response.unreadCount);
    }
  }, [replaceUnreadCount, token]);

  const loadNotifications = useCallback(async (refresh = false) => {
    if (!token || (!refresh && loadedRef.current)) return;
    setLoading(true);
    setError('');
    const changeVersion = notificationChangeVersionRef.current;
    try {
      const response = await getNotifications(token, PAGE_SIZE, 0);
      replaceNotifications(refresh && changeVersion === notificationChangeVersionRef.current
        ? response.items : mergeNotifications(notificationsRef.current, response.items));
      nextOffsetRef.current = response.items.length;
      loadedRef.current = true;
      setHasMore(response.hasMore);
      if (changeVersion === notificationChangeVersionRef.current) {
        replaceUnreadCount(response.unreadCount);
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load notifications right now.'));
    } finally {
      setLoading(false);
    }
  }, [replaceNotifications, replaceUnreadCount, token]);

  const loadMore = useCallback(async () => {
    if (!token || loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const response = await getNotifications(token, PAGE_SIZE, nextOffsetRef.current);
      replaceNotifications(mergeNotifications(notificationsRef.current, response.items));
      nextOffsetRef.current += response.items.length;
      setHasMore(response.hasMore);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load older notifications.'));
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, replaceNotifications, token]);

  const markAsRead = useCallback(async (notificationId: number) => {
    if (!token || markingIdsRef.current.has(notificationId) || markingAllRef.current) return;
    const current = notificationsRef.current.find((item) => item.id === notificationId);
    if (!current || current.read) return;

    markingIdsRef.current.add(notificationId);
    try {
      const updated = await markNotificationRead(notificationId, token);
      replaceNotifications(notificationsRef.current.map((item) => (
        item.id === updated.id ? updated : item
      )));
      if (!current.read && updated.read) {
        notificationChangeVersionRef.current += 1;
        replaceUnreadCount(unreadCountRef.current - 1);
        channelRef.current?.postMessage({ type: 'changed' });
      }
    } finally {
      markingIdsRef.current.delete(notificationId);
    }
  }, [replaceNotifications, replaceUnreadCount, token]);

  const markAllAsRead = useCallback(async () => {
    if (!token || markingAllRef.current || markingIdsRef.current.size > 0 || unreadCountRef.current === 0) return;
    markingAllRef.current = true;
    setMarkingAll(true);
    const changeVersion = notificationChangeVersionRef.current;
    const visibleIds = new Set(notificationsRef.current.map((item) => item.id));
    try {
      const response = await markAllNotificationsRead(token);
      const responseItems = new Map(response.items.map((item) => [item.id, item]));
      replaceNotifications(notificationsRef.current.map((item) => {
        const serverItem = responseItems.get(item.id);
        if (serverItem) return serverItem;
        return visibleIds.has(item.id) ? { ...item, read: true, readAt: item.readAt ?? new Date().toISOString() } : item;
      }));
      setHasMore(response.hasMore);
      const changedDuringMarkAll = changeVersion !== notificationChangeVersionRef.current;
      notificationChangeVersionRef.current += 1;
      if (!changedDuringMarkAll) {
        replaceUnreadCount(response.unreadCount);
      } else {
        await refreshUnreadCount();
      }
      channelRef.current?.postMessage({ type: 'changed' });
    } finally {
      markingAllRef.current = false;
      setMarkingAll(false);
    }
  }, [refreshUnreadCount, replaceNotifications, replaceUnreadCount, token]);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!token || !user || user.status === 'INACTIVE') {
      replaceNotifications([]);
      replaceUnreadCount(0);
      loadedRef.current = false;
      nextOffsetRef.current = 0;
      notificationChangeVersionRef.current = 0;
      setHasMore(false);
      setError('');
      setConnectionState('connecting');
      return undefined;
    }

    let active = true;
    let previousConnectionState: ChatConnectionState = 'connecting';
    void refreshUnreadCount().catch(() => undefined);
    void getNotificationPreferences(token).then((value) => { preferencesRef.current = value; setPreferences(value); })
      .catch(() => { preferencesRef.current = DEFAULT_PREFERENCES; setPreferences(DEFAULT_PREFERENCES); });
    const reconcile = () => { void loadNotifications(true); void refreshUnreadCount().catch(() => undefined); };
    let readRefreshTimer: ReturnType<typeof setTimeout> | undefined;
    const onConversationRead = () => {
      if (!active) return;
      notificationChangeVersionRef.current += 1;
      clearTimeout(readRefreshTimer);
      readRefreshTimer = setTimeout(() => {
        if (!active) return;
        reconcile();
        channelRef.current?.postMessage({ type: 'changed' });
      }, 100);
    };
    const cleanupRead = subscribeToConversationRead(token, onConversationRead);
    window.addEventListener('geochat:conversation-read', onConversationRead);
    const onVisibility = () => { if (document.visibilityState === 'visible') reconcile(); };
    document.addEventListener('visibilitychange', onVisibility);
    if ('BroadcastChannel' in window) {
      channelRef.current = new BroadcastChannel(`geochat-notifications-${user.id}`);
      channelRef.current.onmessage = reconcile;
    }
    const cleanup = subscribeToNotifications(token, {
      onNotification: (notification) => {
        if (!active || notification.recipientId !== user.id) return;
        notificationChangeVersionRef.current += 1;
        const existing = notificationsRef.current.find((item) => item.id === notification.id);
        const incoming = existing?.read && !notification.read ? existing : notification;
        replaceNotifications(mergeNotifications(notificationsRef.current, [incoming]));
        if (!existing && !notification.read) {
          replaceUnreadCount(unreadCountRef.current + 1);
          void refreshUnreadCount().catch(() => undefined);
          channelRef.current?.postMessage({ type: 'changed' });
          const activeConversation = window.location.pathname.match(/^\/app\/chat\/(\d+)$/)?.[1];
          const messageAlert = notification.type === 'NEW_MESSAGE';
          const groupAlert = messageAlert && notification.title !== 'New message';
          const currentPreferences = preferencesRef.current;
          const alertEnabled = messageAlert ? (groupAlert ? currentPreferences.groupAlerts : currentPreferences.directAlerts)
            : notification.type === 'FRIEND_REQUEST_RECEIVED' ? currentPreferences.friendRequestAlerts : currentPreferences.friendAcceptanceAlerts;
          if (alertEnabled && (!messageAlert || String(notification.conversationId) !== activeConversation)) {
            setToasts((current) => [...current.filter((item) => item.id !== notification.id), notification].slice(-3));
            window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== notification.id)), 5000);
          }
        } else if (existing && !existing.read && notification.read) {
          replaceUnreadCount(unreadCountRef.current - 1);
        }
        if (notification.read) {
          setToasts(current => current.filter(item => item.id !== notification.id));
          void refreshUnreadCount().catch(() => undefined);
        }
      },
      onStateChange: (state) => {
        if (!active) return;
        setConnectionState(state);
        if (state === 'connected' && previousConnectionState === 'reconnecting') {
          reconcile();
        }
        previousConnectionState = state;
      },
    });

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisibility);
      channelRef.current?.close(); channelRef.current = null;
      cleanup();
      cleanupRead();
      clearTimeout(readRefreshTimer);
      window.removeEventListener('geochat:conversation-read', onConversationRead);
    };
  }, [authLoading, loadNotifications, refreshUnreadCount, replaceNotifications, replaceUnreadCount, token, user]);

  const value = useMemo<NotificationContextValue>(() => ({
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
    refreshUnreadCount,
    markAsRead,
    markAllAsRead,
    preferences,
    updatePreferences,
  }), [
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
    refreshUnreadCount,
    markAsRead,
    markAllAsRead,
    preferences,
    updatePreferences,
  ]);

  return <NotificationContext.Provider value={value}>{children}<div className="notification-toasts" aria-live="polite" aria-label="New notifications">
    {toasts.map((toast) => <div className="notification-toast" key={toast.id}><strong>{toast.title}</strong><span>{toast.message}</span></div>)}
  </div></NotificationContext.Provider>;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  directAlerts: true, groupAlerts: true, friendRequestAlerts: true, friendAcceptanceAlerts: true,
};

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
}

function mergeNotifications(current: AppNotification[], incoming: AppNotification[]) {
  const merged = new Map(current.map((notification) => [notification.id, notification]));
  for (const notification of incoming) {
    const existing = merged.get(notification.id);
    merged.set(notification.id, existing?.read && !notification.read ? existing : notification);
  }
  return [...merged.values()].sort((left, right) => (
    Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.id - left.id
  ));
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
