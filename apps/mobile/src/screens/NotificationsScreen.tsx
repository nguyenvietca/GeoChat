import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '../api/client';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notificationApi';
import { NotificationItem } from '../components/NotificationItem';
import { FriendNotificationTab, getNotificationDestination } from '../navigation/notificationNavigation';
import { AppNotification } from '../types/notification';

type NotificationsScreenProps = {
  token: string | null;
  onBack: () => void;
  onUnreadCountChange: (count: number) => void;
  onOpenFriends: (tab: FriendNotificationTab) => void;
  refreshVersion?: number;
};

const PAGE_SIZE = 20;

export function NotificationsScreen({
  token,
  onBack,
  onUnreadCountChange,
  onOpenFriends,
  refreshVersion = 0,
}: NotificationsScreenProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [markingIds, setMarkingIds] = useState<number[]>([]);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState('');
  const markingIdsRef = useRef(new Set<number>());
  const unreadCountRef = useRef(0);
  const nextOffsetRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const updateUnreadCount = (count: number) => {
    unreadCountRef.current = count;
    setUnreadCount(count);
    onUnreadCountChange(count);
  };

  const refresh = async (initial = false) => {
    if (!token) {
      setError('Your session has expired. Please log in again.');
      setLoading(false);
      return;
    }

    if (initial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError('');

    try {
      const [listResponse, countResponse] = await Promise.all([
        getNotifications(token, PAGE_SIZE, 0),
        getUnreadNotificationCount(token),
      ]);
      setNotifications(dedupeNotifications(listResponse.items));
      nextOffsetRef.current = (listResponse.offset ?? 0) + listResponse.items.length;
      setHasMore(Boolean(listResponse.hasMore));
      updateUnreadCount(countResponse.unreadCount);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'Unable to load notifications right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh(true);
  }, [token, refreshVersion]);

  const loadMore = async () => {
    if (!token || !hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError('');
    const offset = nextOffsetRef.current;
    try {
      const response = await getNotifications(token, PAGE_SIZE, offset);
      setNotifications((current) => dedupeNotifications([...current, ...response.items]));
      nextOffsetRef.current = offset + response.items.length;
      setHasMore(response.items.length > 0 && Boolean(response.hasMore));
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'Unable to load older notifications right now.');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  const handleNotificationPress = async (notification: AppNotification) => {
    if (markingAll || markingIdsRef.current.size > 0) {
      return;
    }

    setError('');
    if (!notification.read) {
      if (!token) {
        setError('Your session has expired. Please log in again.');
        return;
      }

      markingIdsRef.current.add(notification.id);
      setMarkingIds((current) => [...current, notification.id]);
      try {
        const updatedNotification = await markNotificationRead(notification.id, token);
        setNotifications((current) => current.map((item) => (
          item.id === updatedNotification.id ? updatedNotification : item
        )));
        if (updatedNotification.read) {
          updateUnreadCount(Math.max(0, unreadCountRef.current - 1));
        }
      } catch (markError) {
        setError(markError instanceof ApiError ? markError.message : 'Unable to mark this notification as read.');
        return;
      } finally {
        markingIdsRef.current.delete(notification.id);
        setMarkingIds((current) => current.filter((id) => id !== notification.id));
      }
    }

    const destination = getNotificationDestination(notification);
    if (destination) {
      onOpenFriends(destination);
    }
  };

  const handleMarkAllRead = async () => {
    if (!token || markingAll || markingIdsRef.current.size > 0 || unreadCount === 0) {
      return;
    }

    setMarkingAll(true);
    setError('');
    try {
      const response = await markAllNotificationsRead(token);
      setNotifications((current) => current.map((item) => (
        item.read ? item : { ...item, read: true, readAt: new Date().toISOString() }
      )));
      updateUnreadCount(response.unreadCount);
    } catch (markError) {
      setError(markError instanceof ApiError ? markError.message : 'Unable to mark notifications as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.headingRow}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text accessibilityLiveRegion="polite" style={styles.count}>
            {unreadCount} unread
          </Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            style={[styles.actionButton, (loading || refreshing || markingAll || markingIds.length > 0) && styles.disabledButton]}
            disabled={loading || refreshing || markingAll || markingIds.length > 0}
            onPress={() => void refresh()}
          >
            <Text style={styles.actionText}>{refreshing ? 'Refreshing...' : 'Refresh'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[styles.actionButton, (markingAll || markingIds.length > 0 || unreadCount === 0) && styles.disabledButton]}
            disabled={markingAll || markingIds.length > 0 || unreadCount === 0}
            onPress={() => void handleMarkAllRead()}
          >
            <Text style={styles.actionText}>{markingAll ? 'Marking as read...' : 'Mark all as read'}</Text>
          </Pressable>
        </View>
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#67e8f9" />
          <Text style={styles.stateText}>Loading notifications...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.stateText}>No notifications yet.</Text>
          {error ? (
            <Pressable accessibilityRole="button" onPress={() => void refresh(true)} style={styles.retryButton}>
              <Text style={styles.actionText}>Try again</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={hasMore ? (
            <Pressable accessibilityRole="button" disabled={loadingMore} onPress={() => void loadMore()} style={styles.loadMoreButton}>
              {loadingMore ? <ActivityIndicator color="#67e8c1" /> : <Text style={styles.actionText}>Load older notifications</Text>}
            </Pressable>
          ) : null}
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              disabled={markingIds.includes(item.id)}
              onPress={() => void handleNotificationPress(item)}
            />
          )}
        />
      )}
    </View>
  );
}

function dedupeNotifications(items: AppNotification[]) {
  const uniqueById = new Map<number, AppNotification>();
  for (const item of items) {
    if (!uniqueById.has(item.id)) {
      uniqueById.set(item.id, item);
    }
  }
  return [...uniqueById.values()];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
    paddingRight: 16,
  },
  backText: {
    color: '#67e8f9',
    fontSize: 15,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 12,
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
  },
  count: {
    color: '#cbd5e1',
    fontSize: 14,
    marginTop: 4,
  },
  actions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  actionButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  actionText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.55,
  },
  error: {
    color: '#fca5a5',
    fontSize: 13,
    marginBottom: 8,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    color: '#cbd5e1',
    fontSize: 15,
    marginTop: 10,
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 12,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  listContent: {
    paddingBottom: 24,
  },
  loadMoreButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
});
