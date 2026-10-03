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
import { Friend } from '../types/friend';

type AuthenticatedScreen = 'home' | 'search' | 'nearby' | 'friends' | 'conversations' | 'chat';
type ChatReturnScreen = 'friends' | 'conversations';

export function AppNavigator() {
  const { isAuthenticated, isLoading, token, user } = useAuth();
  const [screen, setScreen] = useState<AuthenticatedScreen>('home');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [chatReturnScreen, setChatReturnScreen] = useState<ChatReturnScreen>('conversations');

  useEffect(() => {
    if (!isAuthenticated) {
      setScreen('home');
      setConversationId(null);
    }
  }, [isAuthenticated]);

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

  return (
    <HomeScreen
      onSearchUsers={() => setScreen('search')}
      onNearbyUsers={() => setScreen('nearby')}
      onFriends={() => setScreen('friends')}
      onMessages={() => setScreen('conversations')}
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
