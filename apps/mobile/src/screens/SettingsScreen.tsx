import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';

type SettingsScreenProps = {
  onBack: () => void;
  onOpenProfile: () => void;
};

export function SettingsScreen({ onBack, onOpenProfile }: SettingsScreenProps) {
  const { logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }
    setLoggingOut(true);
    setError('');
    try {
      await logout();
    } catch {
      setError('Unable to log out right now. Please try again.');
      setLoggingOut(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.sectionTitle}>Account</Text>
      <Pressable accessibilityRole="button" style={styles.row} onPress={onOpenProfile}>
        <Text style={styles.rowTitle}>Profile</Text>
        <Text style={styles.rowHint}>View and edit display name</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Security</Text>
      <View style={styles.infoRow}>
        <Text style={styles.rowTitle}>Password</Text>
        <Text style={styles.rowHint}>Password changes are not available yet.</Text>
      </View>

      <Text style={styles.sectionTitle}>Session</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log out"
        style={[styles.logoutButton, loggingOut && styles.disabledButton]}
        onPress={() => void handleLogout()}
        disabled={loggingOut}
      >
        {loggingOut ? <ActivityIndicator color="#fff" /> : <Text style={styles.logoutText}>Logout</Text>}
      </Pressable>
    </View>
  );
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
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 28,
  },
  sectionTitle: {
    color: '#67e8f9',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  row: {
    minHeight: 62,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  infoRow: {
    minHeight: 62,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: '#334155',
  },
  rowTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
  },
  rowHint: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 3,
  },
  error: {
    color: '#fca5a5',
    fontSize: 14,
    marginBottom: 10,
  },
  logoutButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#be123c',
    borderRadius: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
});