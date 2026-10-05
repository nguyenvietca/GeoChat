import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { AuthScreen } from '../screens/AuthScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { NearbyUsersScreen } from '../screens/NearbyUsersScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { ConversationsScreen } from '../screens/ConversationsScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { UserSearchScreen } from '../screens/UserSearchScreen';
import { openDirectConversation } from '../api/chatApi';
import { getUnreadNotificationCount } from '../api/notificationApi';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { Friend } from '../types/friend';
import { FriendNotificationTab } from './notificationNavigation';

type AuthenticatedScreen =
  | 'home'
  | 'search'
  | 'nearby'
  | 'friends'
  | 'conversations'
  | 'chat'
  | 'notifications'
  | 'profile'
  | 'edit-profile'
  | 'settings';
type ChatReturnScreen = 'friends' | 'conversations';

export function AppNavigator() {
  const { isAuthenticated, isLoading, token, user } = useAuth();
  const [screen, setScreen] = useState<AuthenticatedScreen>('home');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [chatReturnScreen, setChatReturnScreen] = useState<ChatReturnScreen>('conversations');
  const [notificationCount, setNotificationCount] = useState(0);
  const [friendsInitialTab, setFriendsInitialTab] = useState<FriendNotificationTab>('friends');
  const [profileNotice, setProfileNotice] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      setScreen('home');
      setConversationId(null);
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

  const startDirectConversation = async (friend: Friend) => {
    if (!token) {
      throw new Error('Your session has expired. Please log in again.');
    }
    const response = await openDirectConversation(friend.userId, token);
    setConversationId(response.conversationId);
    setChatReturnScreen('friends');
    setScreen('chat');
  };

  const openConversation = (nextConversationId: number) => {
    setConversationId(nextConversationId);
    setChatReturnScreen('conversations');
    setScreen('chat');
  };

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
    return <NearbyUsersScreen token={token} onBack={() => setScreen('home')} />;
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
