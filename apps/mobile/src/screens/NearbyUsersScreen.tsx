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
import { getNearbyUsers, updateMyLocation } from '../api/locationApi';
import { NearbyUser } from '../types/discovery';
import { formatDistance } from '../utils/formatDistance';

type NearbyUsersScreenProps = {
  token: string | null;
  onBack: () => void;
};

type LoadingStage = 'permission' | 'location' | 'sync' | 'nearby';

const loadingMessages: Record<LoadingStage, string> = {
  permission: 'Requesting location permission...',
  location: 'Getting your location...',
  sync: 'Syncing your location...',
  nearby: 'Finding nearby users...',
};

export function NearbyUsersScreen({ token, onBack }: NearbyUsersScreenProps) {
  const [items, setItems] = useState<NearbyUser[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('permission');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [error, setError] = useState('');

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
      setItems(response.items);
    } catch (nearbyError) {
      setItems(null);
      setError(nearbyError instanceof ApiError
        ? nearbyError.message
        : 'Unable to get your location. Check location services and try again.');
    } finally {
      setLoading(false);
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
            <Text style={styles.displayName}>{item.displayName}</Text>
            <Text style={styles.distance}>{formatDistance(item.distanceMeters)}</Text>
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
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingVertical: 14,
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
});