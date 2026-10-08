import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { ApiError } from '../api/client';
import {
  getFriends,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  sendFriendRequest,
} from '../api/friendApi';
import { getNearbyUsers, updateMyLocation } from '../api/locationApi';
import { Friend } from '../types/friend';
import { NearbyUser } from '../types/discovery';
import { FriendNotificationTab } from '../navigation/notificationNavigation';
import { formatDistance } from '../utils/formatDistance';

type NearbyUsersScreenProps = {
  token: string | null;
  onBack: () => void;
  onOpenFriends: (tab?: FriendNotificationTab) => void;
  onMessageUser: (friend: Friend) => Promise<void>;
};

type LoadingStage = 'permission' | 'location' | 'sync' | 'nearby';
type NearbyRelationship = 'NONE' | 'OUTGOING_REQUEST' | 'INCOMING_REQUEST' | 'FRIEND';

const loadingMessages: Record<LoadingStage, string> = {
  permission: 'Requesting location permission...',
  location: 'Getting your location...',
  sync: 'Syncing your location...',
  nearby: 'Finding nearby users...',
};

export function NearbyUsersScreen({ token, onBack, onOpenFriends, onMessageUser }: NearbyUsersScreenProps) {
  const [items, setItems] = useState<NearbyUser[] | null>(null);
  const [relationships, setRelationships] = useState<Record<number, NearbyRelationship>>({});
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('permission');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  const refreshNearby = async () => {
    if (loading) {
      return;
    }
    if (!token) {
      setError('Your session has expired. Please log in again.');
      return;
    }

    setLoading(true);
    setError('');
    setActionError('');
    setNotice('');
    setPermissionDenied(false);
    try {
      setLoadingStage('permission');
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (!permission.granted) {
        setPermissionDenied(true);
        setCanAskAgain(permission.canAskAgain);
        setItems(null);
        return;
      }

      setLoadingStage('location');
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLoadingStage('sync');
      await updateMyLocation(
        {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        },
        token,
      );

      setLoadingStage('nearby');
      const response = await getNearbyUsers(token, 5000);
      if (response.items.length > 0) {
        const [friends, incoming, outgoing] = await Promise.all([
          getFriends(token),
          getIncomingFriendRequests(token),
          getOutgoingFriendRequests(token),
        ]);
        const friendIds = new Set(friends.items.map((friend) => friend.userId));
        const incomingIds = new Set(incoming.items.map((request) => request.user.userId));
        const outgoingIds = new Set(outgoing.items.map((request) => request.user.userId));
        setRelationships(Object.fromEntries(response.items.map((person) => [
          person.userId,
          friendIds.has(person.userId) ? 'FRIEND'
            : incomingIds.has(person.userId) ? 'INCOMING_REQUEST'
              : outgoingIds.has(person.userId) ? 'OUTGOING_REQUEST' : 'NONE',
        ])) as Record<number, NearbyRelationship>);
      } else {
        setRelationships({});
      }
      setItems(response.items);
    } catch (nearbyError) {
      setItems(null);
      setRelationships({});
      setError(nearbyError instanceof ApiError
        ? nearbyError.message
        : 'Unable to get your location. Check location services and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRelationshipAction = async (person: NearbyUser) => {
    if (!token || busyUserId !== null) {
      return;
    }

    const relationship = relationships[person.userId] ?? 'NONE';
    if (relationship === 'OUTGOING_REQUEST') {
      return;
    }

    setBusyUserId(person.userId);
    setActionError('');
    setNotice('');
    try {
      if (relationship === 'NONE') {
        await sendFriendRequest(person.userId, token);
        setRelationships((current) => ({ ...current, [person.userId]: 'OUTGOING_REQUEST' }));
        setNotice(`Friend request sent to ${person.displayName}.`);
      } else if (relationship === 'INCOMING_REQUEST') {
        onOpenFriends('incoming');
      } else {
        await onMessageUser({ userId: person.userId, displayName: person.displayName });
      }
    } catch (actionException) {
      setActionError(actionException instanceof ApiError
        ? actionException.message
        : relationship === 'FRIEND' ? 'Unable to open this conversation.' : 'Unable to update this connection.');
    } finally {
      setBusyUserId(null);
    }
  };

  useEffect(() => {
    void refreshNearby();
  }, []);

  const retryPermission = () => {
    if (canAskAgain) {
      void refreshNearby();
    } else {
      void Linking.openSettings();
    }
  };

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Nearby users</Text>
          <Text style={styles.subtitle}>People within 5 km of your current location.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh nearby users"
          style={[styles.refreshButton, loading && styles.buttonDisabled]}
          onPress={() => void refreshNearby()}
          disabled={loading}
        >
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator color="#67e8f9" />
          <Text style={styles.stateText}>{loadingMessages[loadingStage]}</Text>
        </View>
      ) : null}

      {actionError ? <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text> : null}
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}

      {!loading && permissionDenied ? (
        <View style={styles.stateContainer}>
          <Text style={styles.stateText}>Location permission is required to find nearby users.</Text>
          <Pressable accessibilityRole="button" style={styles.actionButton} onPress={retryPermission}>
            <Text style={styles.actionText}>{canAskAgain ? 'Request permission' : 'Open settings'}</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && error ? (
        <View style={styles.stateContainer}>
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          <Pressable accessibilityRole="button" style={styles.actionButton} onPress={() => void refreshNearby()}>
            <Text style={styles.actionText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !permissionDenied && !error && items?.length === 0 ? (
        <Text style={styles.stateText}>No nearby users found.</Text>
      ) : null}
      {!loading && !permissionDenied && !error && items === null ? (
        <Text style={styles.stateText}>Allow location access to find nearby users.</Text>
      ) : null}

      <FlatList
        data={items ?? []}
        keyExtractor={(item) => String(item.userId)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.resultRow}>
            <View style={styles.resultCopy}>
              <Text style={styles.displayName}>{item.displayName}</Text>
              <Text style={styles.distance}>{formatDistance(item.distanceMeters)}</Text>
            </View>
            {relationships[item.userId] === 'OUTGOING_REQUEST' ? (
              <Text style={styles.relationshipText}>Request sent</Text>
            ) : (
              <Pressable
                accessibilityRole="button"
                style={[styles.relationshipButton, busyUserId !== null && styles.buttonDisabled]}
                onPress={() => void handleRelationshipAction(item)}
                disabled={busyUserId !== null}
              >
                {busyUserId === item.userId
                  ? <ActivityIndicator color="#102a2a" size="small" />
                  : <Text style={styles.relationshipButtonText}>
                    {relationships[item.userId] === 'FRIEND' ? 'Message'
                      : relationships[item.userId] === 'INCOMING_REQUEST' ? 'Review request' : 'Add Friend'}
                  </Text>}
              </Pressable>
            )}
          </View>
        )}
      />
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
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 12,
  },
  headingCopy: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    color: '#f8fafc',
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 14,
    marginTop: 6,
  },
  refreshButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#67e8f9',
    borderRadius: 8,
  },
  refreshText: {
    color: '#102a2a',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  stateContainer: {
    alignItems: 'flex-start',
    paddingVertical: 20,
  },
  stateText: {
    color: '#cbd5e1',
    fontSize: 15,
    marginTop: 10,
  },
  error: {
    color: '#fca5a5',
    fontSize: 14,
  },
  actionButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: '#334155',
    borderRadius: 8,
    marginTop: 12,
  },
  actionText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingTop: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingVertical: 14,
  },
  resultCopy: {
    flex: 1,
    paddingRight: 12,
  },
  displayName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  distance: {
    color: '#67e8f9',
    fontSize: 14,
    marginTop: 4,
  },
  relationshipButton: {
    minHeight: 38,
    minWidth: 94,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#67e8f9',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  relationshipButtonText: {
    color: '#102a2a',
    fontSize: 13,
    fontWeight: '700',
  },
  relationshipText: {
    color: '#67e8f9',
    fontSize: 13,
    fontWeight: '600',
  },
  notice: {
    color: '#86efac',
    fontSize: 14,
    marginTop: 12,
  },
});