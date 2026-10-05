import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppNotification } from '../types/notification';

type NotificationItemProps = {
  notification: AppNotification;
  disabled?: boolean;
  onPress: () => void;
};

export function NotificationItem({ notification, disabled = false, onPress }: NotificationItemProps) {
  const stateLabel = notification.read ? 'Read' : 'Unread';
  const timeLabel = formatNotificationTime(notification.createdAt);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${notification.title}. ${notification.message}. ${stateLabel}. ${timeLabel}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.row, !notification.read && styles.unreadRow]}
    >
      <View style={styles.indicatorColumn}>
        {!notification.read ? <View accessibilityLabel="Unread" style={styles.unreadDot} /> : null}
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{notification.title}</Text>
        <Text style={styles.message}>{notification.message}</Text>
        <Text style={styles.time}>{timeLabel}</Text>
      </View>
    </Pressable>
  );
}

export function formatNotificationTime(value: string, now = Date.now()) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return '';
  }

  const elapsedMinutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (elapsedMinutes < 1) {
    return 'Just now';
  }
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} hour${elapsedHours === 1 ? '' : 's'} ago`;
  }
  if (elapsedHours < 48) {
    return 'Yesterday';
  }

  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  unreadRow: {
    backgroundColor: '#172b3d',
  },
  indicatorColumn: {
    width: 18,
    paddingTop: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#67e8f9',
  },
  copy: {
    flex: 1,
  },
  title: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
  message: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 3,
  },
  time: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 6,
  },
});
