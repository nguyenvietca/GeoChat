import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '../api/client';
import { getConversations } from '../api/chatApi';
import { getGroup } from '../api/groupApi';
import { Conversation } from '../types/chat';
import { GroupInfo } from '../types/group';

type ConversationListItem = Conversation & { groupInfo?: GroupInfo };

type ConversationsScreenProps = {
  token: string | null;
  onBack: () => void;
  onOpenConversation: (conversationId: number) => void;
  onCreateGroup: () => void;
  notice?: string;
};

export function ConversationsScreen({ token, onBack, onOpenConversation, onCreateGroup, notice = '' }: ConversationsScreenProps) {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const refresh = async (initial = false) => {
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
      const response = await getConversations(token);
      const groups = await Promise.all(response.items
        .filter((item) => item.type === 'GROUP')
        .map(async (item) => {
          try {
            return [item.conversationId, await getGroup(item.conversationId, token)] as const;
          } catch {
            return [item.conversationId, null] as const;
          }
        }));
      const groupInfoById = new Map(groups.filter((entry): entry is readonly [number, GroupInfo] => entry[1] !== null));
      const failedGroups = groups.length - groupInfoById.size;
      setConversations(response.items
        .filter((item) => item.type !== 'GROUP' || groupInfoById.has(item.conversationId))
        .map((item) => ({
          ...item,
          ...(groupInfoById.has(item.conversationId) ? { groupInfo: groupInfoById.get(item.conversationId) } : {}),
        })));
      if (failedGroups > 0) {
        setError(`${failedGroups} group${failedGroups === 1 ? '' : 's'} could not be loaded. Refresh to try again.`);
      }
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'Unable to load conversations right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh(true);
  }, []);

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.title}>Messages</Text>
          <Text style={styles.subtitle}>Your direct and group conversations.</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable accessibilityRole="button" style={styles.createButton} onPress={onCreateGroup}>
            <Text style={styles.createText}>＋ Group</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[styles.refreshButton, (loading || refreshing) && styles.buttonDisabled]}
            onPress={() => void refresh()}
            disabled={loading || refreshing}
          >
            <Text style={styles.refreshText}>{refreshing ? 'Refreshing...' : 'Refresh'}</Text>
          </Pressable>
        </View>
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color="#67e8f9" />
          <Text style={styles.stateText}>Loading conversations...</Text>
        </View>
      ) : conversations.length === 0 ? (
        <Text style={styles.stateText}>No conversations yet. Start a chat from Friends or create a group.</Text>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => String(item.conversationId)}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              style={styles.conversationRow}
              onPress={() => onOpenConversation(item.conversationId)}
            >
                {item.groupInfo ? (
                  <View style={styles.groupAvatar}>
                    <Text style={styles.groupAvatarText}>{item.groupInfo.name.trim().charAt(0).toUpperCase()}</Text>
                  </View>
                ) : null}
              <View style={styles.conversationCopy}>
                  <Text style={styles.displayName}>
                    {item.groupInfo?.name ?? item.participant.displayName}
                  </Text>
                  {item.groupInfo ? (
                    <Text style={styles.username} numberOfLines={1}>{item.lastMessage ?? 'No messages yet'}</Text>
                  ) : (
                    <Text style={styles.username}>@{item.participant.username}</Text>
                  )}
              </View>
              <Text style={styles.date}>{formatConversationDate(item.updatedAt)}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function formatConversationDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
    marginBottom: 16,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  createButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#164e63',
    borderRadius: 8,
  },
  createText: { color: '#a5f3fc', fontSize: 14, fontWeight: '600' },
  refreshText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  error: {
    color: '#fca5a5',
    fontSize: 14,
    marginTop: 10,
  },
  notice: { color: '#86efac', fontSize: 14, marginTop: 10 },
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
  conversationRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingVertical: 12,
  },
  groupAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#164e63',
    marginRight: 12,
  },
  groupAvatarText: { color: '#a5f3fc', fontSize: 17, fontWeight: '700' },
  conversationCopy: {
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
    marginTop: 4,
  },
  date: {
    color: '#94a3b8',
    fontSize: 12,
  },
});