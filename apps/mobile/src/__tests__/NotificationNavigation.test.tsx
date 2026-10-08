import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { HomeScreen } from '../screens/HomeScreen';
import {
  getNotificationDestination,
  getPushNotificationDestination,
} from '../navigation/notificationNavigation';
import { AppNotification } from '../types/notification';

jest.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'me', displayName: 'Me' },
    logout: jest.fn(),
  }),
}));

function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 1,
    recipientId: 2,
    type: 'FRIEND_REQUEST_RECEIVED',
    title: 'Friend request',
    message: 'A friend request arrived.',
    referenceType: 'FRIEND_REQUEST',
    referenceId: 9,
    conversationId: null,
    read: false,
    createdAt: '2026-10-05T10:00:00Z',
    readAt: null,
    ...overrides,
  };
}

describe('notification navigation', () => {
  it('routes incoming requests to the Incoming Friends tab', () => {
    expect(getNotificationDestination(makeNotification())).toBe('incoming');
  });

  it('routes accepted requests to Friends', () => {
    expect(getNotificationDestination(makeNotification({ type: 'FRIEND_REQUEST_ACCEPTED' }))).toBe('friends');
  });

  it('does not treat a message ID as a conversation ID', () => {
    expect(getNotificationDestination(makeNotification({
      type: 'NEW_MESSAGE',
      referenceType: 'MESSAGE',
      referenceId: 123,
    }))).toBeNull();
  });

  it('rejects a friend notification without a valid reference ID', () => {
    expect(getNotificationDestination(makeNotification({ referenceId: 0 }))).toBeNull();
  });

  it('routes push notifications to incoming requests, friends, and the matching chat', () => {
    expect(getPushNotificationDestination({ type: 'FRIEND_REQUEST_RECEIVED', friendRequestId: 9 }))
      .toEqual({ screen: 'friends', tab: 'incoming' });
    expect(getPushNotificationDestination({ type: 'FRIEND_REQUEST_ACCEPTED', friendRequestId: 9 }))
      .toEqual({ screen: 'friends', tab: 'friends' });
    expect(getPushNotificationDestination({ type: 'NEW_MESSAGE', conversationId: 45 }))
      .toEqual({ screen: 'chat', conversationId: 45 });
  });

  it('sends unknown or malformed push data to Notifications', () => {
    expect(getPushNotificationDestination(null)).toEqual({ screen: 'notifications' });
    expect(getPushNotificationDestination({ type: 'NEW_MESSAGE', conversationId: '45' }))
      .toEqual({ screen: 'notifications' });
    expect(getPushNotificationDestination({ type: 'UNKNOWN' })).toEqual({ screen: 'notifications' });
  });
});

describe('HomeScreen notification entry', () => {
  it('shows the unread badge and opens Notifications', () => {
    const onNotifications = jest.fn();
    render(<HomeScreen onNotifications={onNotifications} notificationCount={4} />);

    fireEvent.press(screen.getByText('Notifications (4)'));

    expect(onNotifications).toHaveBeenCalledTimes(1);
  });

  it('shows the Notifications entry without a badge when there are no unread items', () => {
    render(<HomeScreen onNotifications={jest.fn()} notificationCount={0} />);

    expect(screen.getByText('Notifications')).toBeTruthy();
  });
});
