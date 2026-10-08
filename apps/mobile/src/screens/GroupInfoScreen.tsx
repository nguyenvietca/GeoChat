import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '../api/client';
import { getFriends } from '../api/friendApi';
import { addGroupMembers, getGroup, getGroupMembers, leaveGroup, removeGroupMember } from '../api/groupApi';
import { MAX_GROUP_MEMBERS } from '../config/group';
import { Friend } from '../types/friend';
import { GroupInfo, GroupMember } from '../types/group';

type GroupInfoScreenProps = {
  groupId: number;
  currentUserId: number | null;
  token: string | null;
  onBack: () => void;
  onLeft: () => void;
  onAccessDenied?: (message: string) => void;
};

export function GroupInfoScreen({ groupId, currentUserId, token, onBack, onLeft, onAccessDenied }: GroupInfoScreenProps) {
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const leavingRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setError('Your session has expired. Please log in again.');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    void Promise.all([getGroup(groupId, token), getGroupMembers(groupId, token)])
      .then(([groupResponse, memberResponse]) => {
        if (active) {
          setGroup(groupResponse);
          setMembers(memberResponse.items);
        }
      }).catch((loadError: unknown) => {
        if (active) {
          if (loadError instanceof ApiError && (loadError.status === 403 || loadError.status === 404) && onAccessDenied) {
            onAccessDenied('This group is unavailable or you are no longer a member.');
            return;
          }
          setError(loadError instanceof ApiError ? loadError.message : 'Unable to load group information.');
        }
      }).finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [groupId, token, onAccessDenied]);

  const leave = async () => {
    if (!token || leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    setError('');
    try {
      await leaveGroup(groupId, token);
      onLeft();
    } catch (leaveError) {
      setError(leaveError instanceof ApiError ? leaveError.message : 'Unable to leave this group.');
    } finally {
      leavingRef.current = false;
      setLeaving(false);
    }
  };

  const isOwner = group?.owner.userId === currentUserId
    || members.some((member) => member.user.userId === currentUserId && member.role === 'OWNER');

  const confirmAction = (title: string, message: string, confirmLabel: string, onConfirm: () => void) => {
    // Alert.alert does nothing on react-native-web.
    if (Platform.OS === 'web') {
      if (window.confirm(message)) onConfirm();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: confirmLabel, style: 'destructive', onPress: onConfirm },
    ]);
  };

  const refreshMembers = async (updated: GroupInfo) => {
    if (!token) return;
    setGroup(updated);
    const response = await getGroupMembers(groupId, token);
    setMembers(response.items);
  };

  const toggleAdd = async () => {
    const next = !showAdd;
    setShowAdd(next);
    setSelectedIds([]);
    if (next && friends === null && token) {
      try {
        setFriends((await getFriends(token)).items);
      } catch (friendError) {
        setError(friendError instanceof ApiError ? friendError.message : 'Unable to load friends.');
        setShowAdd(false);
      }
    }
  };

  const roomLeft = MAX_GROUP_MEMBERS - (group?.memberCount ?? 0);
  const memberIdSet = new Set(members.map((member) => member.user.userId));
  const candidates = (friends ?? []).filter((friend) => !memberIdSet.has(friend.userId));

  const toggleFriend = (userId: number) => setSelectedIds((current) => current.includes(userId)
    ? current.filter((id) => id !== userId)
    : current.length < roomLeft ? [...current, userId] : current);

  const addSelected = async () => {
    if (!token || adding || selectedIds.length === 0) return;
    setAdding(true);
    setError('');
    try {
      await refreshMembers(await addGroupMembers(groupId, selectedIds, token));
      setSelectedIds([]);
      setShowAdd(false);
    } catch (addError) {
      setError(addError instanceof ApiError ? addError.message : 'Unable to add members.');
    } finally {
      setAdding(false);
    }
  };

  const removeMember = async (member: GroupMember) => {
    if (!token || removingId !== null) return;
    setRemovingId(member.user.userId);
    setError('');
    try {
      await refreshMembers(await removeGroupMember(groupId, member.user.userId, token));
    } catch (removeError) {
      setError(removeError instanceof ApiError ? removeError.message : 'Unable to remove this member.');
    } finally {
      setRemovingId(null);
    }
  };

  const confirmLeave = () => confirmAction(
    'Leave group',
    'Are you sure you want to leave this group?',
    'Leave Group',
    () => void leave(),
  );

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>Back to chat</Text>
      </Pressable>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color="#67e8f9" />
          <Text style={styles.stateText}>Loading group information...</Text>
        </View>
      ) : error && !group ? (
        <View style={styles.errorState}>
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.backToChatButton}>
            <Text style={styles.backText}>Return to chat</Text>
          </Pressable>
        </View>
      ) : group ? (
        <ScrollView>
          <Text style={styles.title}>{group.name}</Text>
          <Text style={styles.subtitle}>Owner: {group.owner.displayName}</Text>
          <Text style={styles.memberCount}>{group.memberCount} members</Text>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Text style={styles.sectionTitle}>Members</Text>
          {members.length === 0 ? (
            <Text style={styles.stateText}>No members to show.</Text>
          ) : (
            <FlatList
              data={members}
              scrollEnabled={false}
              keyExtractor={(member) => String(member.user.userId)}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const owner = item.role === 'OWNER';
                return (
                  <View style={styles.memberRow}>
                    <View style={styles.memberCopy}>
                      <Text style={styles.memberName}>{item.user.displayName}</Text>
                      <Text style={styles.username}>@{item.user.username}</Text>
                    </View>
                    <Text style={[styles.role, owner && styles.ownerRole]}>{owner ? 'Owner' : 'Member'}</Text>
                    {isOwner && !owner ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${item.user.displayName}`}
                        style={[styles.removeButton, removingId !== null && styles.disabled]}
                        disabled={removingId !== null}
                        onPress={() => confirmAction(
                          'Remove member',
                          `Remove ${item.user.displayName} from this group?`,
                          'Remove',
                          () => void removeMember(item),
                        )}
                      >
                        <Text style={styles.removeText}>{removingId === item.user.userId ? 'Removing...' : 'Remove'}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              }}
            />
          )}
          {isOwner ? (
            <>
              <Pressable
                accessibilityRole="button"
                style={[styles.addButton, (roomLeft <= 0 && !showAdd) && styles.disabled]}
                onPress={() => void toggleAdd()}
                disabled={roomLeft <= 0 && !showAdd}
              >
                <Text style={styles.addText}>{roomLeft <= 0 ? 'Group is full' : 'Add members'}</Text>
              </Pressable>
              {showAdd ? (
                <View style={styles.addPanel}>
                  {friends === null ? <ActivityIndicator color="#67e8f9" /> : null}
                  {friends !== null && candidates.length === 0 ? (
                    <Text style={styles.stateText}>All your friends are already in this group.</Text>
                  ) : null}
                  {candidates.map((friend) => {
                    const checked = selectedIds.includes(friend.userId);
                    return (
                      <Pressable
                        key={friend.userId}
                        accessibilityRole="checkbox"
                        accessibilityLabel={`Select ${friend.displayName}`}
                        accessibilityState={{ checked, disabled: adding || (!checked && selectedIds.length >= roomLeft) }}
                        style={styles.candidateRow}
                        disabled={adding || (!checked && selectedIds.length >= roomLeft)}
                        onPress={() => toggleFriend(friend.userId)}
                      >
                        <Text style={styles.memberName}>{friend.displayName}</Text>
                        <Text style={styles.addText}>{checked ? '✓' : ''}</Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.addButton, (adding || selectedIds.length === 0) && styles.disabled]}
                    disabled={adding || selectedIds.length === 0}
                    onPress={() => void addSelected()}
                  >
                    {adding ? <ActivityIndicator color="#67e8f9" /> : <Text style={styles.addText}>Add selected</Text>}
                  </Pressable>
                </View>
              ) : null}
              <Text style={styles.ownerNotice}>Group owners cannot leave until ownership transfer is supported.</Text>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              style={[styles.leaveButton, leaving && styles.disabled]}
              onPress={confirmLeave}
              disabled={leaving}
            >
              {leaving ? <ActivityIndicator color="#fecaca" /> : <Text style={styles.leaveText}>Leave Group</Text>}
            </Pressable>
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 24 },
  backButton: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', paddingRight: 16 },
  backText: { color: '#67e8f9', fontSize: 15 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stateText: { color: '#cbd5e1', fontSize: 15, marginTop: 12 },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  error: { color: '#fca5a5', fontSize: 14, marginTop: 12 },
  backToChatButton: { minHeight: 42, justifyContent: 'center', padding: 12, marginTop: 8 },
  title: { color: '#f8fafc', fontSize: 27, fontWeight: '700', marginTop: 16 },
  subtitle: { color: '#cbd5e1', fontSize: 15, marginTop: 8 },
  memberCount: { color: '#94a3b8', fontSize: 13, marginTop: 5 },
  sectionTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '600', marginTop: 28, marginBottom: 8 },
  listContent: { paddingBottom: 12 },
  memberRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingVertical: 10,
  },
  memberCopy: { flex: 1 },
  memberName: { color: '#f8fafc', fontSize: 15, fontWeight: '600' },
  username: { color: '#94a3b8', fontSize: 13, marginTop: 3 },
  role: { color: '#cbd5e1', fontSize: 12 },
  ownerRole: { color: '#67e8f9', fontWeight: '700' },
  ownerNotice: { color: '#fbbf24', fontSize: 13, marginTop: 20 },
  removeButton: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 10, marginLeft: 10, borderWidth: 1, borderColor: '#f87171', borderRadius: 8 },
  removeText: { color: '#fecaca', fontSize: 12, fontWeight: '600' },
  addButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#67e8f9', borderRadius: 8, marginTop: 12 },
  addText: { color: '#67e8f9', fontSize: 14, fontWeight: '600' },
  addPanel: { marginTop: 8 },
  candidateRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#334155' },
  leaveButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f87171',
    borderRadius: 8,
    marginTop: 16,
  },
  leaveText: { color: '#fecaca', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.55 },
});