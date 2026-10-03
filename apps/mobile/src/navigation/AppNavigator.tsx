import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { AuthScreen } from '../screens/AuthScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { NearbyUsersScreen } from '../screens/NearbyUsersScreen';
import { UserSearchScreen } from '../screens/UserSearchScreen';

type AuthenticatedScreen = 'home' | 'search' | 'nearby';

export function AppNavigator() {
  const { isAuthenticated, isLoading, token } = useAuth();
  const [screen, setScreen] = useState<AuthenticatedScreen>('home');

  useEffect(() => {
    if (!isAuthenticated) {
      setScreen('home');
    }
  }, [isAuthenticated]);

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
    return <UserSearchScreen token={token} onBack={() => setScreen('home')} />;
  }

  if (screen === 'nearby') {
    return <NearbyUsersScreen token={token} onBack={() => setScreen('home')} />;
  }

  return (
    <HomeScreen
      onSearchUsers={() => setScreen('search')}
      onNearbyUsers={() => setScreen('nearby')}
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
