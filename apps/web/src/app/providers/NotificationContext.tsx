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
import { getNotifications, getUnreadNotificationCount, markAllNotificationsRead, markNotificationRead } from '../../api/notifications';
import { AppNotification, NotificationListResponse } from '../../types';
import { useAuth } from './AuthContext';
import { ChatConnectionState, subscribeToNotifications } from '../../services/chatWebSocket';

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
  const notificationsRef = useRef<AppNotification[]>([]);
  const unreadCountRef = useRef(0);
  const loadedRef = useRef(false);
  const nextOffsetRef = useRef(0);
  const notificationChangeVersionRef = useRef(0);
  const markingIdsRef = useRef(new Set<number>());
  const markingAllRef = useRef(false);

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
      replaceNotifications(mergeNotifications(notificationsRef.current, response.items));
      nextOffsetRef.current = Math.max(nextOffsetRef.current, response.items.length);
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
    } finally {
      markingAllRef.current = false;
      setMarkingAll(false);
    }
  }, [refreshUnreadCount, replaceNotifications, replaceUnreadCount, token]);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!token || !user) {
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
        } else if (existing && !existing.read && notification.read) {
          replaceUnreadCount(unreadCountRef.current - 1);
        }
      },
      onStateChange: (state) => {
        if (!active) return;
        setConnectionState(state);
        if (state === 'connected' && previousConnectionState === 'reconnecting') {
          void refreshUnreadCount().catch(() => undefined);
        }
        previousConnectionState = state;
      },
    });

    return () => {
      active = false;
      cleanup();
    };
  }, [authLoading, refreshUnreadCount, replaceNotifications, replaceUnreadCount, token, user]);

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
  ]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

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