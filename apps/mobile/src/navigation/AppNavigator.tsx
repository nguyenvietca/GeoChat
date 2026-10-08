import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { AuthScreen } from '../screens/AuthScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { NearbyUsersScreen } from '../screens/NearbyUsersScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { ConversationsScreen } from '../screens/ConversationsScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { CreateGroupScreen } from '../screens/CreateGroupScreen';
import { GroupInfoScreen } from '../screens/GroupInfoScreen';
import { UserSearchScreen } from '../screens/UserSearchScreen';
import { openDirectConversation } from '../api/chatApi';
import { getUnreadNotificationCount } from '../api/notificationApi';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { Friend } from '../types/friend';
import {
  FriendNotificationTab,
  getPushNotificationDestination,
  PushNotificationDestination,
} from './notificationNavigation';
import { addPushNotificationListeners } from '../services/pushNotificationService';
import { subscribeToNotifications } from '../services/chatWebSocketService';

type AuthenticatedScreen =
  | 'home'
  | 'search'
  | 'nearby'
  | 'friends'
  | 'conversations'
  | 'create-group'
  | 'group-info'
  | 'chat'
  | 'notifications'
  | 'profile'
  | 'edit-profile'
  | 'settings';
type ChatReturnScreen = 'friends' | 'conversations' | 'nearby';

export function AppNavigator() {
  const { isAuthenticated, isLoading, token, user } = useAuth();
  const [screen, setScreen] = useState<AuthenticatedScreen>('home');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [chatReturnScreen, setChatReturnScreen] = useState<ChatReturnScreen>('conversations');
  const [notificationCount, setNotificationCount] = useState(0);
  const [friendsInitialTab, setFriendsInitialTab] = useState<FriendNotificationTab>('friends');
  const [profileNotice, setProfileNotice] = useState('');
  const [conversationNotice, setConversationNotice] = useState('');
  const [notificationRefreshVersion, setNotificationRefreshVersion] = useState(0);
  const [pendingPushDestination, setPendingPushDestination] = useState<{
    destination: PushNotificationDestination;
    identifier: string;
  } | null>(null);
  const latestSession = useRef({ isAuthenticated, token });
  const handledPushResponses = useRef(new Set<string>());
  latestSession.current = { isAuthenticated, token };

  useEffect(() => addPushNotificationListeners({
    onReceived: () => {
      setNotificationRefreshVersion((version) => version + 1);
      const session = latestSession.current;
      if (session.isAuthenticated && session.token) {
        void getUnreadNotificationCount(session.token)
          .then((response) => setNotificationCount(response.unreadCount))
          .catch(() => undefined);
      }
    },
    onResponse: (data, identifier) => {
      if (handledPushResponses.current.has(identifier)) {
        return;
      }
      handledPushResponses.current.add(identifier);
      setPendingPushDestination({
        destination: getPushNotificationDestination(data),
        identifier,
      });
    },
  }), []);

  useEffect(() => {
    if (!pendingPushDestination || isLoading || !isAuthenticated) {
      return;
    }

    const { destination } = pendingPushDestination;
    if (destination.screen === 'friends') {
      setFriendsInitialTab(destination.tab);
      setScreen('friends');
    } else if (destination.screen === 'chat') {
      setConversationId(destination.conversationId);
      setChatReturnScreen('conversations');
      setScreen('chat');
    } else {
      setScreen('notifications');
    }
    setPendingPushDestination(null);
  }, [pendingPushDestination, isAuthenticated, isLoading]);

  useEffect(() => {
    if (!isAuthenticated) {
      setScreen('home');
      setConversationId(null);
      setConversationNotice('');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !token || screen !== 'home') {
      return undefined;
    }

    let active = true;
    void getUnreadNotificationCount(token)
      .then((response) => {
        if (active) {
          setNotificationCount(response.unreadCount);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [isAuthenticated, screen, token]);

  useEffect(() => {
    if (!isAuthenticated || !token || !user) {
      return undefined;
    }

    let active = true;
    const cleanup = subscribeToNotifications(token, {
      onNotification: (notification) => {
        if (!active || notification.recipientId !== user.id) {
          return;
        }
        setNotificationRefreshVersion((version) => version + 1);
        void getUnreadNotificationCount(token)
          .then((response) => {
            if (active) {
              setNotificationCount(response.unreadCount);
            }
          })
          .catch(() => undefined);
      },
      onStateChange: (state) => {
        if (active && state === 'connected') {
          void getUnreadNotificationCount(token)
            .then((response) => {
              if (active) {
                setNotificationCount(response.unreadCount);
              }
            })
            .catch(() => undefined);
        }
      },
    });

    return () => {
      active = false;
      cleanup();
    };
  }, [isAuthenticated, token, user?.id]);

  const startDirectConversation = async (friend: Friend, returnScreen: ChatReturnScreen = 'friends') => {
    if (!token) {
      throw new Error('Your session has expired. Please log in again.');
    }
    const response = await openDirectConversation(friend.userId, token);
    setConversationId(response.conversationId);
    setChatReturnScreen(returnScreen);
    setScreen('chat');
  };

  const openConversation = (nextConversationId: number) => {
    setConversationId(nextConversationId);
    setConversationNotice('');
    setChatReturnScreen('conversations');
    setScreen('chat');
  };

  const returnToConversations = useCallback((message: string) => {
    setConversationNotice(message);
    setScreen('conversations');
  }, []);

  const openFriends = (tab: FriendNotificationTab = 'friends') => {
    setFriendsInitialTab(tab);
    setScreen('friends');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#67e8f9" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  if (screen === 'search') {
    return (
      <UserSearchScreen
        token={token}
        currentUserId={user?.id ?? null}
        onBack={() => setScreen('home')}
        onOpenFriends={() => setScreen('friends')}
      />
    );
  }

  if (screen === 'nearby') {
    return (
      <NearbyUsersScreen
        token={token}
        onBack={() => setScreen('home')}
        onOpenFriends={openFriends}
        onMessageUser={(friend) => startDirectConversation(friend, 'nearby')}
      />
    );
  }

  if (screen === 'friends') {
    return (
      <FriendsScreen
        token={token}
        onBack={() => setScreen('home')}
        onMessageFriend={startDirectConversation}
        initialTab={friendsInitialTab}
      />
    );
  }

  if (screen === 'conversations') {
    return (
      <ConversationsScreen
        token={token}
        onBack={() => setScreen('home')}
        onOpenConversation={openConversation}
        onCreateGroup={() => setScreen('create-group')}
        notice={conversationNotice}
      />
    );
  }

  if (screen === 'create-group') {
    return (
      <CreateGroupScreen
        token={token}
        currentUserId={user?.id ?? null}
        onBack={() => setScreen('conversations')}
        onGroupCreated={openConversation}
      />
    );
  }

  if (screen === 'chat' && conversationId !== null) {
    return (
      <ChatScreen
        conversationId={conversationId}
        currentUserId={user?.id ?? null}
        token={token}
        onBack={() => setScreen(chatReturnScreen)}
        onOpenGroupInfo={() => setScreen('group-info')}
        onAccessDenied={returnToConversations}
      />
    );
  }

  if (screen === 'group-info' && conversationId !== null) {
    return (
      <GroupInfoScreen
        groupId={conversationId}
        currentUserId={user?.id ?? null}
        token={token}
        onBack={() => setScreen('chat')}
        onLeft={() => returnToConversations('You left the group.')}
        onAccessDenied={returnToConversations}
      />
    );
  }

  if (screen === 'notifications') {
    return (
      <NotificationsScreen
        token={token}
        onBack={() => setScreen('home')}
        onUnreadCountChange={setNotificationCount}
        onOpenFriends={openFriends}
        refreshVersion={notificationRefreshVersion}
      />
    );
  }

  if (screen === 'profile') {
    return (
      <ProfileScreen
        onBack={() => setScreen('home')}
        onEditProfile={() => setScreen('edit-profile')}
        onOpenSettings={() => setScreen('settings')}
        notice={profileNotice}
        onClearNotice={() => setProfileNotice('')}
      />
    );
  }

  if (screen === 'edit-profile') {
    return (
      <EditProfileScreen
        onBack={() => setScreen('profile')}
        onSaved={() => {
          setProfileNotice('Profile updated successfully.');
          setScreen('profile');
        }}
      />
    );
  }

  if (screen === 'settings') {
    return (
      <SettingsScreen
        onBack={() => setScreen('profile')}
        onOpenProfile={() => setScreen('profile')}
      />
    );
  }

  return (
    <HomeScreen
      onSearchUsers={() => setScreen('search')}
      onNearbyUsers={() => setScreen('nearby')}
      onFriends={() => openFriends()}
      onMessages={() => setScreen('conversations')}
      onNotifications={() => setScreen('notifications')}
      notificationCount={notificationCount}
      onProfile={() => setScreen('profile')}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
