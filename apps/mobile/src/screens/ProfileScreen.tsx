import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '../api/client';
import { getMyProfile } from '../api/userApi';
import { useAuth } from '../auth/AuthContext';

type ProfileScreenProps = {
  onBack: () => void;
  onEditProfile: () => void;
  onOpenSettings: () => void;
  notice?: string;
  onClearNotice?: () => void;
};

export function ProfileScreen({
  onBack,
  onEditProfile,
  onOpenSettings,
  notice,
  onClearNotice,
}: ProfileScreenProps) {
  const { token, user, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const refreshProfile = async (initial = false) => {
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
      updateUser(await getMyProfile(token));
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'Unable to load your profile.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refreshProfile(true);
  }, [token, updateUser]);

  const initials = (user?.displayName || user?.username || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <ScrollView
        contentContainerStyle={styles.content}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refreshProfile()}
              tintColor="#67e8f9"
            />
          )}
      >
        <View style={styles.headingRow}>
          <Text style={styles.title}>Profile</Text>
          {loading ? (
            <View style={styles.loadingIndicator}>
              <ActivityIndicator color="#67e8f9" />
              <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorBlock}>
            <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void refreshProfile(true)}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
        {notice ? (
          <Pressable accessibilityRole="button" onPress={onClearNotice} style={styles.noticeBlock}>
            <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>
          </Pressable>
        ) : null}

        <View style={styles.profileHeader}>
          <View accessibilityLabel="Profile avatar placeholder" style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || '?'}</Text>
          </View>
          <Text style={styles.displayName}>{user?.displayName ?? 'Profile unavailable'}</Text>
          <Text style={styles.username}>@{user?.username ?? 'unknown'}</Text>
        </View>

        <View style={styles.details}>
          <Text style={styles.detailLabel}>Username</Text>
          <Text style={styles.detailValue}>{user?.username ?? 'Unavailable'}</Text>
          {user?.createdAt ? (
            <>
              <Text style={styles.detailLabel}>Member since</Text>
              <Text style={styles.detailValue}>{formatMemberDate(user.createdAt)}</Text>
            </>
          ) : null}
        </View>

        <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={onEditProfile}>
          <Text style={styles.primaryButtonText}>Edit profile</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={onOpenSettings}>
          <Text style={styles.secondaryButtonText}>Settings</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function formatMemberDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unavailable'
    : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingHorizontal: 24,
    paddingTop: 12,
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
  content: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 24,
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
  },
  loadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0e7490',
    borderWidth: 2,
    borderColor: '#67e8f9',
    marginBottom: 16,
  },
  avatarText: {
    color: '#ecfeff',
    fontSize: 30,
    fontWeight: '700',
  },
  displayName: {
    color: '#f8fafc',
    fontSize: 23,
    fontWeight: '700',
    textAlign: 'center',
  },
  username: {
    color: '#94a3b8',
    fontSize: 15,
    marginTop: 5,
  },
  details: {
    marginTop: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#334155',
  },
  detailLabel: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 8,
  },
  detailValue: {
    color: '#f8fafc',
    fontSize: 16,
    marginTop: 3,
    marginBottom: 8,
  },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#67e8f9',
    borderRadius: 8,
    marginTop: 24,
  },
  primaryButtonText: {
    color: '#102a2a',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    marginTop: 10,
  },
  secondaryButtonText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
  },
  errorBlock: {
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#3f1d2d',
    borderRadius: 8,
  },
  error: {
    color: '#fecaca',
    fontSize: 14,
  },
  retryText: {
    color: '#67e8f9',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  noticeBlock: {
    padding: 12,
    backgroundColor: '#064e3b',
    borderRadius: 8,
  },
  notice: {
    color: '#d1fae5',
    fontSize: 14,
  },
});