import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError } from '../api/client';
import { createGroup } from '../api/groupApi';
import { getFriends } from '../api/friendApi';
import { GROUP_NAME_MAX_LENGTH, MAX_GROUP_MEMBERS } from '../config/group';
import { Friend } from '../types/friend';

type CreateGroupScreenProps = {
  token: string | null;
  currentUserId: number | null;
  onBack: () => void;
  onGroupCreated: (groupId: number) => void;
};

export function CreateGroupScreen({ token, currentUserId, onBack, onGroupCreated }: CreateGroupScreenProps) {
  const [name, setName] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const creatingRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setError('Your session has expired. Please log in again.');
      setLoadingFriends(false);
      return;
    }

    let active = true;
    void getFriends(token).then((response) => {
      if (active) {
        setFriends(response.items.filter((friend) => friend.userId !== currentUserId));
      }
    }).catch((loadError: unknown) => {
      if (active) {
        setError(loadError instanceof ApiError ? loadError.message : 'Unable to load friends right now.');
      }
    }).finally(() => {
      if (active) {
        setLoadingFriends(false);
      }
    });

    return () => {
      active = false;
    };
  }, [currentUserId, token]);

  const toggleFriend = (userId: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else if (next.size + 1 < MAX_GROUP_MEMBERS) {
        next.add(userId);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Enter a group name.');
      return;
    }
    if (trimmedName.length > GROUP_NAME_MAX_LENGTH) {
      setError(`Group names must be ${GROUP_NAME_MAX_LENGTH} characters or fewer.`);
      return;
    }
    if (!token || creatingRef.current) {
      return;
    }

    creatingRef.current = true;
    setCreating(true);
    setError('');
    try {
      const group = await createGroup({ name: trimmedName, memberIds: [...selectedIds] }, token);
      onGroupCreated(group.groupId);
    } catch (createError) {
      setError(createError instanceof ApiError ? createError.message : 'Unable to create this group.');
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  const memberLimitReached = selectedIds.size + 1 >= MAX_GROUP_MEMBERS;
  const selectedNames = friends
    .filter((friend) => selectedIds.has(friend.userId))
    .map((friend) => friend.displayName)
    .join(', ');

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <Text style={styles.title}>Create a group</Text>
      <Text style={styles.subtitle}>You will be the owner.</Text>
      <TextInput
        accessibilityLabel="Group name"
        style={styles.nameInput}
        placeholder="Group name"
        placeholderTextColor="#94a3b8"
        value={name}
        onChangeText={(value) => {
          setName(value);
          if (error) setError('');
        }}
        maxLength={GROUP_NAME_MAX_LENGTH + 1}
        editable={!creating}
      />
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Add friends</Text>
        <Text style={styles.memberCount}>{selectedIds.size} selected</Text>
      </View>
      <Text style={styles.selectedMembers}>
        {selectedNames ? `Selected: ${selectedNames}` : 'No friends selected'}
      </Text>

      {loadingFriends ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color="#67e8f9" />
          <Text style={styles.stateText}>Loading friends...</Text>
        </View>
      ) : friends.length === 0 ? (
        <Text style={styles.stateText}>You don't have any friends to add yet.</Text>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(friend) => String(friend.userId)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const selected = selectedIds.has(item.userId);
            const disabled = creating || (!selected && memberLimitReached);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={`Select ${item.displayName}`}
                accessibilityState={{ checked: selected, disabled }}
                style={[styles.friendRow, disabled && styles.disabled]}
                onPress={() => toggleFriend(item.userId)}
                disabled={disabled}
              >
                <View style={styles.friendCopy}>
                  <Text style={styles.friendName}>{item.displayName}</Text>
                  {item.username ? <Text style={styles.username}>@{item.username}</Text> : null}
                </View>
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        style={[styles.createButton, creating && styles.disabled]}
        onPress={() => void handleCreate()}
        disabled={creating || !token}
      >
        {creating ? <ActivityIndicator color="#102a2a" /> : <Text style={styles.createButtonText}>Create group</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 24 },
  backButton: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', paddingRight: 16 },
  backText: { color: '#67e8f9', fontSize: 15 },
  title: { color: '#f8fafc', fontSize: 28, fontWeight: '700', marginTop: 12 },
  subtitle: { color: '#cbd5e1', fontSize: 14, marginTop: 5, marginBottom: 20 },
  nameInput: {
    minHeight: 48,
    color: '#f8fafc',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  sectionTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '600' },
  memberCount: { color: '#94a3b8', fontSize: 13 },
  selectedMembers: { color: '#94a3b8', fontSize: 13, marginTop: 8, minHeight: 18 },
  loadingState: { alignItems: 'flex-start', paddingVertical: 24 },
  stateText: { color: '#cbd5e1', fontSize: 15, marginTop: 18 },
  listContent: { paddingTop: 8, paddingBottom: 12 },
  friendRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingVertical: 10,
  },
  friendCopy: { flex: 1 },
  friendName: { color: '#f8fafc', fontSize: 16, fontWeight: '600' },
  username: { color: '#94a3b8', fontSize: 13, marginTop: 3 },
  checkbox: { width: 24, height: 24, borderWidth: 1, borderColor: '#64748b', borderRadius: 4 },
  checkboxSelected: { backgroundColor: '#67e8f9', borderColor: '#67e8f9', alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: '#102a2a', fontSize: 16, fontWeight: '700' },
  error: { color: '#fca5a5', fontSize: 14, paddingVertical: 8 },
  createButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#67e8f9',
    borderRadius: 8,
    marginTop: 12,
  },
  createButtonText: { color: '#102a2a', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.55 },
});