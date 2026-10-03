import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '../api/client';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  getFriends,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  rejectFriendRequest,
} from '../api/friendApi';
import { Friend, FriendRequestItem } from '../types/friend';

type FriendsScreenProps = {
  token: string | null;
  onBack: () => void;
  onMessageFriend: (friend: Friend) => Promise<void>;
};

type FriendsTab = 'friends' | 'incoming' | 'outgoing';

type FriendRow = {
  key: string;
  userId: number;
  displayName: string;
};

const tabLabels: Record<FriendsTab, string> = {
  friends: 'Friends',
  incoming: 'Incoming',
  outgoing: 'Sent',
};

export function FriendsScreen({ token, onBack, onMessageFriend }: FriendsScreenProps) {
  const [activeTab, setActiveTab] = useState<FriendsTab>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyRequestIds, setBusyRequestIds] = useState<number[]>([]);
  const busyRequestIdsRef = useRef(new Set<number>());
  const [openingFriendId, setOpeningFriendId] = useState<number | null>(null);
  const openingFriendIdsRef = useRef(new Set<number>());
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = async (isInitialLoad = false) => {
    if (!token) {
      setError('Your session has expired. Please log in again.');
      setLoading(false);
      return;
    }

    if (isInitialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError('');
    setNotice('');

    try {
      const [friendsResponse, incomingResponse, outgoingResponse] = await Promise.all([
        getFriends(token),
        getIncomingFriendRequests(token),
        getOutgoingFriendRequests(token),
      ]);
      setFriends(friendsResponse.items);
      setIncoming(incomingResponse.items);
      setOutgoing(outgoingResponse.items);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'Unable to load friends right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh(true);
  }, []);

  const runRequestAction = async (
    request: FriendRequestItem,
    action: 'accept' | 'reject' | 'cancel',
  ) => {
    if (!token || busyRequestIdsRef.current.has(request.requestId)) {
      return;
    }

    busyRequestIdsRef.current.add(request.requestId);
    setBusyRequestIds((currentIds) => [...currentIds, request.requestId]);
    setError('');
    setNotice('');

    try {
      if (action === 'accept') {
        await acceptFriendRequest(request.requestId, token);
        setIncoming((current) => current.filter((item) => item.requestId !== request.requestId));
        const updatedFriends = await getFriends(token);
        setFriends(updatedFriends.items);
        setNotice('Friend request accepted.');
      } else if (action === 'reject') {
        await rejectFriendRequest(request.requestId, token);
        setIncoming((current) => current.filter((item) => item.requestId !== request.requestId));
        setNotice('Friend request rejected.');
      } else {
        await cancelFriendRequest(request.requestId, token);
        setOutgoing((current) => current.filter((item) => item.requestId !== request.requestId));
        setNotice('Friend request cancelled.');
      }
    } catch (actionError) {
      setError(actionError instanceof ApiError ? actionError.message : 'Unable to update the request.');
    } finally {
      busyRequestIdsRef.current.delete(request.requestId);
      setBusyRequestIds((currentIds) => currentIds.filter((id) => id !== request.requestId));
    }
  };

  const handleMessageFriend = async (friend: Friend) => {
    if (openingFriendIdsRef.current.has(friend.userId)) {
      return;
    }
    openingFriendIdsRef.current.add(friend.userId);
    setOpeningFriendId(friend.userId);
    setError('');
    setNotice('');
    try {
      await onMessageFriend(friend);
    } catch (openError) {
      setError(openError instanceof ApiError ? openError.message : 'Unable to open this conversation.');
    } finally {
      openingFriendIdsRef.current.delete(friend.userId);
      setOpeningFriendId(null);
    }
  };

  const activeItems: FriendRow[] = activeTab === 'friends'
    ? friends.map((friend) => ({ key: `friend-${friend.userId}`, userId: friend.userId, displayName: friend.displayName }))
    : (activeTab === 'incoming' ? incoming : outgoing).map((request) => ({
      key: `request-${request.requestId}`,
      userId: request.user.userId,
      displayName: request.user.displayName,
    }));

  const emptyMessage = activeTab === 'friends'
    ? "You don't have any friends yet."
    : activeTab === 'incoming'
      ? 'No incoming friend requests.'
      : 'No outgoing friend requests.';

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.title}>Friends</Text>
          <Text style={styles.subtitle}>Manage your friends and requests.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          style={[styles.refreshButton, (loading || refreshing) && styles.buttonDisabled]}
          onPress={() => void refresh()}
          disabled={loading || refreshing}
        >
          <Text style={styles.refreshText}>{refreshing ? 'Refreshing...' : 'Refresh'}</Text>
        </Pressable>
      </View>

      <View accessibilityRole="tablist" style={styles.tabs}>
        {(['friends', 'incoming', 'outgoing'] as FriendsTab[]).map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tabLabels[tab]}{tab === 'incoming' && incoming.length > 0 ? ` (${incoming.length})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color="#67e8f9" />
          <Text style={styles.stateText}>Loading {tabLabels[activeTab].toLowerCase()}...</Text>
        </View>
      ) : activeItems.length === 0 ? (
        <Text style={styles.stateText}>{emptyMessage}</Text>
      ) : (
        <FlatList
          data={activeItems}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          renderItem={({ item, index }) => {
            const request = activeTab === 'friends' ? null : (activeTab === 'incoming' ? incoming : outgoing)[index];
            const isBusy = request ? busyRequestIds.includes(request.requestId) : false;
            const isOpening = activeTab === 'friends' && openingFriendId === item.userId;
            return (
              <View style={styles.row}>
                <Text style={styles.displayName}>{item.displayName}</Text>
                {activeTab === 'friends' ? (
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.messageButton, isOpening && styles.buttonDisabled]}
                    onPress={() => void handleMessageFriend({ userId: item.userId, displayName: item.displayName })}
                    disabled={openingFriendId !== null}
                  >
                    {isOpening
                      ? <ActivityIndicator color="#102a2a" size="small" />
                      : <Text style={styles.messageButtonText}>Message</Text>}
                  </Pressable>
                ) : null}
                {activeTab === 'incoming' && request ? (
                  <View style={styles.actions}>
                    <Pressable
                      accessibilityRole="button"
                      style={[styles.acceptButton, isBusy && styles.buttonDisabled]}
                      onPress={() => void runRequestAction(request, 'accept')}
                      disabled={isBusy}
                    >
                      <Text style={styles.acceptText}>{isBusy ? 'Accepting...' : 'Accept'}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      style={[styles.rejectButton, isBusy && styles.buttonDisabled]}
                      onPress={() => void runRequestAction(request, 'reject')}
                      disabled={isBusy}
                    >
                      <Text style={styles.rejectText}>{isBusy ? 'Rejecting...' : 'Reject'}</Text>
                    </Pressable>
                  </View>
                ) : null}
                {activeTab === 'outgoing' && request ? (
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.rejectButton, isBusy && styles.buttonDisabled]}
                    onPress={() => void runRequestAction(request, 'cancel')}
                    disabled={isBusy}
                  >
                    <Text style={styles.rejectText}>{isBusy ? 'Cancelling...' : 'Cancel'}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          }}
        />
      )}
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
    marginBottom: 18,
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 14,
    marginTop: 5,
  },
  refreshButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  refreshText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#67e8f9',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#f8fafc',
  },
  error: {
    color: '#fca5a5',
    fontSize: 14,
    marginTop: 14,
  },
  notice: {
    color: '#86efac',
    fontSize: 14,
    marginTop: 14,
  },
  loadingState: {
    alignItems: 'flex-start',
    paddingVertical: 24,
  },
  stateText: {
    color: '#cbd5e1',
    fontSize: 15,
    marginTop: 18,
  },
  listContent: {
    paddingTop: 8,
  },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingVertical: 14,
  },
  displayName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  messageButton: {
    alignSelf: 'flex-start',
    minHeight: 36,
    minWidth: 86,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#67e8f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  messageButtonText: {
    color: '#102a2a',
    fontSize: 13,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 10,
  },
  acceptButton: {
    minHeight: 38,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#67e8f9',
    borderRadius: 8,
    marginRight: 8,
    paddingHorizontal: 10,
  },
  acceptText: {
    color: '#102a2a',
    fontSize: 14,
    fontWeight: '700',
  },
  rejectButton: {
    minHeight: 38,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  rejectText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});