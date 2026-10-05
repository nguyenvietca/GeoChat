import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError } from '../api/client';
import { getConversationDetail, getMessages, sendMessage } from '../api/chatApi';
import { ChatConnectionState, subscribeToConversation } from '../services/chatWebSocketService';
import { ChatMessage, ConversationDetail } from '../types/chat';

const MESSAGE_PAGE_SIZE = 20;
const MESSAGE_MAX_LENGTH = 5000;

type ChatScreenProps = {
  conversationId: number;
  currentUserId: number | null;
  token: string | null;
  onBack: () => void;
};

export function ChatScreen({ conversationId, currentUserId, token, onBack }: ChatScreenProps) {
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [page, setPage] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [connection, setConnection] = useState<ChatConnectionState>('connecting');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');
  const [validationError, setValidationError] = useState('');
  const sendingRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const nearBottomRef = useRef(true);
  const shouldScrollToLatestRef = useRef(true);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (!token) {
      setError('Your session has expired. Please log in again.');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    void Promise.all([
      getConversationDetail(conversationId, token),
      getMessages(conversationId, token, 0, MESSAGE_PAGE_SIZE),
    ]).then(([detail, history]) => {
      if (!active) {
        return;
      }
      setConversation(detail);
      setMessages((current) => mergeMessages(current, history.items));
      setPage(history.page);
      setTotalMessages(history.total);
      shouldScrollToLatestRef.current = true;
    }).catch((loadError: unknown) => {
      if (active) {
        setError(loadError instanceof ApiError ? loadError.message : 'Unable to load this conversation.');
      }
    }).finally(() => {
      if (active) {
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [conversationId, token]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    return subscribeToConversation(conversationId, token, {
      onStateChange: setConnection,
      onMessage: (message) => {
        const shouldFollow = nearBottomRef.current;
        if (shouldFollow) {
          shouldScrollToLatestRef.current = true;
        }
        setMessages((current) => mergeMessages(current, [message]));
      },
    });
  }, [conversationId, token]);

  const canLoadOlder = totalMessages > (page + 1) * MESSAGE_PAGE_SIZE;

  const loadOlderMessages = async () => {
    if (!token || loadingOlderRef.current || !canLoadOlder) {
      return;
    }

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    setError('');
    try {
      const nextPage = page + 1;
      const response = await getMessages(conversationId, token, nextPage, MESSAGE_PAGE_SIZE);
      setMessages((current) => mergeMessages(response.items, current));
      setPage(response.page);
      setTotalMessages(response.total);
      shouldScrollToLatestRef.current = false;
    } catch (historyError) {
      setError(historyError instanceof ApiError ? historyError.message : 'Unable to load older messages.');
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  };

  const retryConversationLoad = async () => {
    if (!token || loading) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [detail, history] = await Promise.all([
        getConversationDetail(conversationId, token),
        getMessages(conversationId, token, 0, MESSAGE_PAGE_SIZE),
      ]);
      setConversation(detail);
      setMessages((current) => mergeMessages(current, history.items));
      setPage(history.page);
      setTotalMessages(history.total);
      shouldScrollToLatestRef.current = true;
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'Unable to load this conversation.');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const content = draft.trim();
    if (!content) {
      setValidationError('Enter a message before sending.');
      return;
    }
    if (content.length > MESSAGE_MAX_LENGTH) {
      setValidationError(`Messages must be ${MESSAGE_MAX_LENGTH} characters or fewer.`);
      return;
    }
    if (!token || sendingRef.current) {
      return;
    }

    sendingRef.current = true;
    setSending(true);
    setValidationError('');
    setSendError('');
    shouldScrollToLatestRef.current = true;
    try {
      const savedMessage = await sendMessage(conversationId, { content }, token);
      setMessages((current) => mergeMessages(current, [savedMessage]));
      setTotalMessages((currentTotal) => currentTotal + 1);
      setDraft((currentDraft) => currentDraft === draft ? '' : currentDraft);
    } catch (sendFailure) {
      setSendError(sendFailure instanceof ApiError ? sendFailure.message : 'Unable to send the message.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    nearBottomRef.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 100;
  };

  const handleContentSizeChange = () => {
    if (shouldScrollToLatestRef.current) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      shouldScrollToLatestRef.current = false;
    }
  };

  const otherParticipant = conversation?.participants.find((participant) => participant.userId !== currentUserId);
  const connectionLabel = {
    connecting: 'Connecting...',
    connected: 'Live',
    reconnecting: 'Reconnecting...',
    error: 'Live connection unavailable',
  }[connection];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{otherParticipant?.displayName ?? 'Conversation'}</Text>
          <Text style={[styles.connection, connection === 'connected' && styles.connected]}>{connectionLabel}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color="#67e8f9" />
          <Text style={styles.stateText}>Loading messages...</Text>
        </View>
      ) : error && !conversation ? (
        <View style={styles.errorState}>
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => void retryConversationLoad()}>
            <Text style={styles.retryText}>Retry loading messages</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.backToListButton} onPress={onBack}>
            <Text style={styles.backToListText}>Back to conversations</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {canLoadOlder ? (
            <Pressable
              accessibilityRole="button"
              style={styles.loadOlderButton}
              onPress={() => void loadOlderMessages()}
              disabled={loadingOlder}
            >
              <Text style={styles.loadOlderText}>{loadingOlder ? 'Loading older messages...' : 'Load older messages'}</Text>
            </Pressable>
          ) : null}

          {error ? <Text accessibilityRole="alert" style={styles.inlineError}>{error}</Text> : null}
          {sendError ? <Text accessibilityRole="alert" style={styles.inlineError}>{sendError}</Text> : null}

          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.stateText}>No messages yet.</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              style={styles.messageList}
              data={messages}
              keyExtractor={(item) => String(item.messageId)}
              contentContainerStyle={styles.messageListContent}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onContentSizeChange={handleContentSizeChange}
              maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
              renderItem={({ item }) => {
                const isOutgoing = currentUserId !== null && item.senderId === currentUserId;
                return (
                  <View style={[styles.messageRow, isOutgoing ? styles.outgoingRow : styles.incomingRow]}>
                    <View style={[styles.bubble, isOutgoing ? styles.outgoingBubble : styles.incomingBubble]}>
                      <Text style={[styles.messageText, isOutgoing && styles.outgoingText]}>{item.content}</Text>
                      <Text style={[styles.timestamp, isOutgoing && styles.outgoingTimestamp]}>
                        {formatMessageTime(item.createdAt)}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
          )}

          {validationError ? <Text accessibilityRole="alert" style={styles.inlineError}>{validationError}</Text> : null}
          <View style={styles.composer}>
            <TextInput
              accessibilityLabel="Message"
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="#94a3b8"
              value={draft}
              onChangeText={(value) => {
                setDraft(value);
                if (validationError) {
                  setValidationError('');
                }
              }}
              multiline
              maxLength={MESSAGE_MAX_LENGTH + 1}
              editable={!sending}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              style={[styles.sendButton, sending && styles.sendButtonDisabled]}
              onPress={() => void handleSend()}
              disabled={sending}
            >
              {sending ? <ActivityIndicator color="#102a2a" /> : <Text style={styles.sendText}>Send</Text>}
            </Pressable>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]) {
  const messagesById = new Map<number, ChatMessage>();
  for (const message of existing) {
    messagesById.set(message.messageId, message);
  }
  for (const message of incoming) {
    messagesById.set(message.messageId, message);
  }
  return [...messagesById.values()].sort((first, second) => {
    const timeDifference = Date.parse(first.createdAt) - Date.parse(second.createdAt);
    return timeDifference || first.messageId - second.messageId;
  });
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingRight: 16,
  },
  backText: {
    color: '#67e8f9',
    fontSize: 15,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  connection: {
    color: '#fbbf24',
    fontSize: 12,
    marginTop: 3,
  },
  connected: {
    color: '#86efac',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    color: '#cbd5e1',
    fontSize: 15,
    marginTop: 10,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  error: {
    color: '#fca5a5',
    fontSize: 15,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: '#334155',
    borderRadius: 8,
    marginTop: 16,
  },
  retryText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  backToListButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 6,
  },
  backToListText: {
    color: '#67e8f9',
    fontSize: 14,
  },
  loadOlderButton: {
    alignSelf: 'center',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  loadOlderText: {
    color: '#67e8f9',
    fontSize: 13,
    fontWeight: '600',
  },
  inlineError: {
    color: '#fca5a5',
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySubtext: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 5,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageRow: {
    width: '100%',
    marginVertical: 4,
  },
  incomingRow: {
    alignItems: 'flex-start',
  },
  outgoingRow: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '84%',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  incomingBubble: {
    backgroundColor: '#334155',
  },
  outgoingBubble: {
    backgroundColor: '#67e8f9',
  },
  messageText: {
    color: '#f8fafc',
    fontSize: 15,
  },
  outgoingText: {
    color: '#102a2a',
  },
  timestamp: {
    color: '#cbd5e1',
    fontSize: 10,
    textAlign: 'right',
    marginTop: 4,
  },
  outgoingTimestamp: {
    color: '#164e63',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  input: {
    flex: 1,
    maxHeight: 112,
    minHeight: 46,
    color: '#f8fafc',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendButton: {
    minWidth: 62,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#67e8f9',
    borderRadius: 8,
    marginLeft: 8,
    paddingHorizontal: 10,
  },
  sendButtonDisabled: {
    opacity: 0.55,
  },
  sendText: {
    color: '#102a2a',
    fontSize: 14,
    fontWeight: '700',
  },
});