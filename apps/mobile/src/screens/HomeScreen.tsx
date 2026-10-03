import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';

type HomeScreenProps = {
  onSearchUsers?: () => void;
  onNearbyUsers?: () => void;
};

export function HomeScreen({ onSearchUsers, onNearbyUsers }: HomeScreenProps) {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>GeoChat</Text>
        <Text style={styles.title}>Welcome, {user?.displayName ?? user?.username ?? 'friend'}!</Text>
        <Text style={styles.subtitle}>You are signed in as @{user?.username ?? 'unknown'}.</Text>

        {onSearchUsers ? (
          <Pressable accessibilityRole="button" style={styles.actionButton} onPress={onSearchUsers}>
            <Text style={styles.actionButtonText}>Search users</Text>
          </Pressable>
        ) : null}
        {onNearbyUsers ? (
          <Pressable accessibilityRole="button" style={styles.actionButton} onPress={onNearbyUsers}>
            <Text style={styles.actionButtonText}>Nearby users</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" style={styles.logoutButton} onPress={() => void logout()}>
          <Text style={styles.buttonText}>Logout</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 24,
  },
  eyebrow: {
    color: '#67e8f9',
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 16,
    marginBottom: 24,
  },
  actionButton: {
    backgroundColor: '#67e8f9',
    borderRadius: 8,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  actionButtonText: {
    color: '#102a2a',
    fontSize: 15,
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: '#be123c',
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
