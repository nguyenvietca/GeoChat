import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError } from '../api/client';
import { sendFriendRequest } from '../api/friendApi';
import { searchUsers } from '../api/userApi';
import { UserSearchResult } from '../types/discovery';
import { getFriendRelationshipState } from '../utils/friendRelationship';

type UserSearchScreenProps = {
  token: string | null;
  currentUserId: number | null;
  onBack: () => void;
  onOpenFriends: () => void;
};

export function UserSearchScreen({ token, currentUserId, onBack, onOpenFriends }: UserSearchScreenProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingUserId, setSendingUserId] = useState<number | null>(null);
  const sendingUserIdsRef = useRef(new Set<number>());
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  const handleSearch = async () => {
    if (loading) {
      return;
    }

    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setResults(null);
      setError('Enter at least 2 characters to search.');
      return;
    }

    if (normalizedQuery.length > 100) {
      setResults(null);
      setError('Search must be 100 characters or fewer.');
      return;
    }

    if (!token) {
      setResults(null);
      setError('Your session has expired. Please log in again.');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    setError('');
    setActionError('');
    setNotice('');
    try {
      const response = await searchUsers(normalizedQuery, token);
      setResults(response.items);
    } catch (searchError) {
      setResults(null);
      setError(searchError instanceof ApiError ? searchError.message : 'Unable to search right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async (result: UserSearchResult) => {
    if (!token || sendingUserIdsRef.current.has(result.userId) || getFriendRelationshipState(result.relationship, currentUserId, result.userId) !== 'NONE') {
      return;
    }

    sendingUserIdsRef.current.add(result.userId);
    setSendingUserId(result.userId);
    setActionError('');
    setNotice('');
    try {
      await sendFriendRequest(result.userId, token);
      setResults((currentResults) => currentResults?.map((item) => item.userId === result.userId
        ? { ...item, relationship: 'PENDING_OUTGOING' }
        : item) ?? null);
      setNotice(`Friend request sent to ${result.displayName}.`);
    } catch (requestError) {
      setActionError(requestError instanceof ApiError
        ? requestError.message
        : 'Unable to send the friend request right now.');
    } finally {
      sendingUserIdsRef.current.delete(result.userId);
      setSendingUserId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <Text style={styles.title}>Search users</Text>
      <Text style={styles.subtitle}>Find people by name or username.</Text>

      <TextInput
        accessibilityLabel="Search users"
        style={styles.input}
        placeholder="Name or username"
        placeholderTextColor="#94a3b8"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => void handleSearch()}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={100}
      />
      <Pressable
        accessibilityRole="button"
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={() => void handleSearch()}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#102a2a" /> : <Text style={styles.buttonText}>Search</Text>}
      </Pressable>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {actionError ? <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text> : null}
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
      {loading ? <Text style={styles.stateText}>Searching...</Text> : null}
      {!loading && results === null && !error ? (
        <Text style={styles.stateText}>Enter a name or username to begin.</Text>
      ) : null}
      {!loading && results?.length === 0 ? (
        <Text style={styles.stateText}>No users found.</Text>
      ) : null}
      <FlatList
        data={results ?? []}
        keyExtractor={(item) => String(item.userId)}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <View style={styles.resultRow}>
            <View style={styles.resultCopy}>
              <Text style={styles.displayName}>{item.displayName}</Text>
              <Text style={styles.username}>@{item.username}</Text>
            </View>
            {(() => {
              const relationship = getFriendRelationshipState(item.relationship, currentUserId, item.userId);
              if (relationship === 'NONE') {
                return (
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.friendButton, sendingUserId !== null && styles.buttonDisabled]}
                    onPress={() => void handleSendFriendRequest(item)}
                    disabled={sendingUserId !== null}
                  >
                    {sendingUserId === item.userId
                      ? (
                        <View style={styles.sendingContents}>
                          <ActivityIndicator color="#102a2a" />
                          <Text style={styles.friendButtonText}>Sending...</Text>
                        </View>
                      )
                      : <Text style={styles.friendButtonText}>Add Friend</Text>}
                  </Pressable>
                );
              }
              if (relationship === 'INCOMING_REQUEST') {
                return (
                  <Pressable accessibilityRole="button" style={styles.stateButton} onPress={onOpenFriends}>
                    <Text style={styles.stateButtonText}>Review request</Text>
                  </Pressable>
                );
              }
              const labels = {
                SELF: 'You',
                FRIEND: 'Friends',
                OUTGOING_REQUEST: 'Request sent',
              } as const;
              return <Text style={styles.relationshipText}>{labels[relationship]}</Text>;
            })()}
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
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 12,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 15,
    marginTop: 6,
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#1f2937',
    color: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  button: {
    backgroundColor: '#67e8f9',
    borderRadius: 8,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#102a2a',
    fontSize: 15,
    fontWeight: '700',
  },
  error: {
    color: '#fca5a5',
    fontSize: 14,
    marginTop: 16,
  },
  stateText: {
    color: '#cbd5e1',
    fontSize: 15,
    marginTop: 20,
  },
  listContent: {
    paddingTop: 14,
  },
  resultRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  username: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 3,
  },
  friendButton: {
    minWidth: 96,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#67e8f9',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  friendButtonText: {
    color: '#102a2a',
    fontSize: 13,
    fontWeight: '700',
  },
  stateButton: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  stateButtonText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  relationshipText: {
    color: '#67e8f9',
    fontSize: 13,
    fontWeight: '600',
  },
  sendingContents: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
  },
  notice: {
    color: '#86efac',
    fontSize: 14,
    marginTop: 12,
  },
});