import { FormEvent, KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getConversationDetail, getConversationPresence, getMessages, sendMessage } from '../../api/chats';
import { ApiError } from '../../api/client';
import { getGroup } from '../../api/groups';
import { useAuth } from '../../app/providers/AuthContext';
import { ChatConnectionState, publishTypingState, subscribeToConversation, subscribeToPresence } from '../../services/chatWebSocket';
import { ChatMessage, ChatTypingEvent, ConversationReadState, ConversationDetail, GroupInfo } from '../../types';
import { useConversationRead } from './useConversationRead';
import { compareMessageOrder, formatMessageTime } from './messagePresentation';
import { LimitedChatFriendship } from './LimitedChatFriendship';
import { GroupInfoPanel } from './GroupInfoPanel';
import { MessageActions } from './MessageActions';
import { applyReactionState } from './reactions';
import { getMessageReactions, setMessageReaction } from '../../api/reactions';
import { MessageReactionState, ReplyPreview } from '../../types';

const PAGE_SIZE = 20;
const MAX_MESSAGE_LENGTH = 5000;
const TYPING_IDLE_MS = 2200;
const TYPING_REFRESH_MS = 3000;
const TYPING_EXPIRY_MS = 7000;

type ChatPanelProps = {
  conversationId: number;
  groupInfo: GroupInfo | null;
  titleHint?: string;
  onReadState?: (state: ConversationReadState) => void;
  onMessage?: (message: ChatMessage, sender?: string) => void;
  onBack: () => void;
  onLeftGroup: () => void;
  onGroupChanged: (group: GroupInfo) => void;
  onOpenConversation: (conversationId: number) => void;
};

// Rendered with key={conversationId} so switching conversations resets all state and subscriptions.
export function ChatPanel({ conversationId, groupInfo, titleHint, onBack, onLeftGroup, onGroupChanged, onOpenConversation, onMessage, onReadState }: ChatPanelProps) {
  const { token, user } = useAuth();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [limitedMessagesRemaining, setLimitedMessagesRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [replyTarget, setReplyTarget] = useState<ReplyPreview | null>(null);
  const [actionFeedback, setActionFeedback] = useState('');
  const [reactionBusy, setReactionBusy] = useState<Set<number>>(new Set());
  const reactionBusyRef = useRef(new Set<number>());
  const reactionStatesRef = useRef(new Map<number, MessageReactionState>());
  const reactionEventVersionsRef = useRef(new Map<number, number>());
  const pendingReactionIdsRef = useRef(new Set<number>());
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');
  const [checkingRecent, setCheckingRecent] = useState(false);
  const [connection, setConnection] = useState<ChatConnectionState>('connecting');
  const [participantOnline, setParticipantOnline] = useState<boolean | null>(null);
  const [presenceLoading, setPresenceLoading] = useState(false);
  const [typingNames, setTypingNames] = useState<Record<number, string>>({});
  const messageAreaRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const shouldScrollToBottomRef = useRef(true);
  const smoothScrollRef = useRef(false);
  const pendingOlderScrollRef = useRef<{ height: number; top: number } | null>(null);
  const sendingRef = useRef(false);
  const composingRef = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const typingActiveRef = useRef(false);
  const typingIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingEventIdsRef = useRef(new Map<number, number>());
  const typingExpiryTimersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;
  const knownMessageIds = useRef(new Set<number>());
  useConversationRead(conversationId, token, messages, loading, messageAreaRef, onReadState);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    };
  }, []);

  function applyReactionSnapshot(states: MessageReactionState[]) {
    for (const state of states) {
      const previous = reactionStatesRef.current.get(state.messageId);
      if (previous && state.version < previous.version) continue;
      reactionStatesRef.current.set(state.messageId, state);
    }
    setMessages((current) => current.map((message) => applyReactionState(message, reactionStatesRef.current.get(message.messageId))));
  }

  async function refreshReactions(ids: number[]) {
    if (!token || ids.length === 0) return;
    try {
      for (let offset = 0; offset < ids.length; offset += 100) {
        const response = await getMessageReactions(conversationId, ids.slice(offset, offset + 100), token);
        if (!mountedRef.current) return;
        applyReactionSnapshot(response.items);
      }
    } catch {
      if (mountedRef.current) setActionFeedback('Unable to refresh reactions.');
    }
  }

  function queueReactionRefresh(messageId: number) {
    pendingReactionIdsRef.current.add(messageId);
    if (reactionTimerRef.current) return;
    reactionTimerRef.current = setTimeout(() => {
      reactionTimerRef.current = null;
      const ids = [...pendingReactionIdsRef.current];
      pendingReactionIdsRef.current.clear();
      void refreshReactions(ids);
    }, 60);
  }

  async function toggleReaction(messageId: number, key: string, add: boolean) {
    if (!token || reactionBusyRef.current.has(messageId)) return;
    reactionBusyRef.current.add(messageId);
    setReactionBusy(new Set(reactionBusyRef.current));
    setActionFeedback('');
    try {
      const state = await setMessageReaction(conversationId, messageId, key, add, token);
      if (mountedRef.current) applyReactionSnapshot([state]);
    } catch (failure) {
      if (mountedRef.current) {
        setActionFeedback(failure instanceof ApiError ? failure.message : 'Unable to update reaction. Try again.');
        queueReactionRefresh(messageId);
      }
    } finally {
      reactionBusyRef.current.delete(messageId);
      if (mountedRef.current) setReactionBusy(new Set(reactionBusyRef.current));
    }
  }

  useEffect(() => {
    if (!Number.isSafeInteger(conversationId) || conversationId <= 0) {
      setError('This conversation link is invalid.');
      setLoading(false);
      return undefined;
    }
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError('');
    knownMessageIds.current.clear();
    shouldScrollToBottomRef.current = true;
    void Promise.all([
      getConversationDetail(conversationId, token),
      getMessages(conversationId, 0, PAGE_SIZE, token),
    ]).then(async ([detail, response]) => {
      const info = detail.type === 'GROUP' ? await getGroup(conversationId, token) : null;
      if (!active) return;
      setConversation(detail);
      setLimitedMessagesRemaining(detail.limitedMessagesRemaining ?? null);
      setGroup(info);
      if (info) onGroupChanged(info);
      for (const message of response.items) knownMessageIds.current.add(message.messageId);
      setMessages((current) => mergeMessages(current, response.items.map((message) => applyReactionState(message, reactionStatesRef.current.get(message.messageId)))));
      for (const message of response.items) {
        if ((reactionEventVersionsRef.current.get(message.messageId) ?? 0) > (message.reactionVersion ?? 0)) queueReactionRefresh(message.messageId);
      }
      setTotal(Math.max(response.total, response.items.length));
      setPage(response.page);
    }).catch((loadError: unknown) => {
      if (!active) return;
      const denied = loadError instanceof ApiError && (loadError.status === 403 || loadError.status === 404);
      setError(denied ? 'This conversation is unavailable or you no longer have access.'
        : loadError instanceof ApiError ? loadError.message : 'Unable to load this conversation.');
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [conversationId, token]);

  useEffect(() => {
    if (groupInfo?.groupId === conversationId) setGroup(groupInfo);
  }, [conversationId, groupInfo]);

  useEffect(() => {
    if (!token || !conversation || conversation.type !== 'DIRECT') {
      setParticipantOnline(null);
      setPresenceLoading(false);
      return undefined;
    }
    const otherParticipant = conversation.participants.find((item) => item.userId !== user?.id);
    if (!otherParticipant) return undefined;

    let active = true;
    let realtimeVersion = 0;
    setParticipantOnline(null);
    setPresenceLoading(true);
    const refreshPresence = () => {
      const version = realtimeVersion;
      void getConversationPresence(conversationId, token)
        .then((response) => {
          if (!active || version !== realtimeVersion) return;
          const presence = response.items.find((item) => item.userId === otherParticipant.userId);
          setParticipantOnline(presence?.online ?? false);
        })
        .catch(() => {
          if (active && version === realtimeVersion) setParticipantOnline(null);
        })
        .finally(() => { if (active && version === realtimeVersion) setPresenceLoading(false); });
    };
    const unsubscribe = subscribeToPresence(otherParticipant.userId, token, {
      onPresence: (presence) => {
        realtimeVersion += 1;
        if (active) {
          setParticipantOnline(presence.online);
          setPresenceLoading(false);
          if (!presence.online) removeTypingUser(presence.userId);
        }
      },
      onStateChange: (state) => {
        if (state === 'reconnecting') {
          setParticipantOnline(null);
          setPresenceLoading(true);
        } else if (state === 'connected') {
          refreshPresence();
        }
      },
    });
    refreshPresence();

    return () => { active = false; unsubscribe(); };
  }, [conversation, conversationId, token, user?.id]);

  useEffect(() => {
    if (!token || !Number.isSafeInteger(conversationId) || conversationId <= 0) return undefined;
    let active = true;
    let connected = false;
    const unsubscribe = subscribeToConversation(conversationId, token, {
      onStateChange: (state) => {
        if (!active) return;
        setConnection(state);
        if (state === 'reconnecting') { clearRemoteTyping(); typingEventIdsRef.current.clear(); }
        if (state === 'connected') {
          // Reconcile all loaded pages, including older messages, without reloading history.
          if (connected) void refreshReactions([...knownMessageIds.current]);
          if (typingActiveRef.current && draftRef.current.trim()) {
            publishTypingState(conversationId, token, 'START');
          }
          if (connected && conversationRef.current?.type === 'GROUP') void getGroup(conversationId, token).then((info) => {
            if (active) { setGroup(info); onGroupChanged(info); }
          }).catch(() => {});
          if (connected) void getMessages(conversationId, 0, PAGE_SIZE, token).then((response) => {
            if (!active) return;
            for (const message of response.items) addMessage(message);
            setTotal(response.total);
          }).catch(() => {});
          connected = true;
        }
      },
      onMessage: (message) => { if (active) addMessage(message); },
      onTyping: (event) => { if (active) receiveTyping(event); },
      onReaction: (event) => {
        if (!active || event.conversationId !== conversationId) return;
        const previous = Math.max(reactionEventVersionsRef.current.get(event.messageId) ?? 0,
          reactionStatesRef.current.get(event.messageId)?.version ?? 0);
        if (event.version <= previous) return;
        reactionEventVersionsRef.current.set(event.messageId, event.version);
        if (knownMessageIds.current.has(event.messageId)) queueReactionRefresh(event.messageId);
      },
    });
    return () => {
      active = false;
      stopTyping();
      clearTypingExpiryTimers();
      typingEventIdsRef.current.clear();
      unsubscribe();
    };
  }, [conversationId, token]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stopTyping();
      clearRemoteTyping();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [conversationId, token]);

  useEffect(() => {
    if (loading || limitedMessagesRemaining === 0) stopTyping();
  }, [loading, limitedMessagesRemaining]);

  useLayoutEffect(() => {
    const area = messageAreaRef.current;
    if (!area) return;
    const previous = pendingOlderScrollRef.current;
    if (previous) {
      area.scrollTop = previous.top + (area.scrollHeight - previous.height);
      pendingOlderScrollRef.current = null;
    } else if (shouldScrollToBottomRef.current) {
      if (smoothScrollRef.current && typeof area.scrollTo === 'function') {
        area.scrollTo({ top: area.scrollHeight, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      } else area.scrollTop = area.scrollHeight;
      shouldScrollToBottomRef.current = false;
      smoothScrollRef.current = false;
    }
  }, [messages]);

  function addMessage(message: ChatMessage) {
    if (message.conversationId !== conversationId || knownMessageIds.current.has(message.messageId)) return;
    knownMessageIds.current.add(message.messageId);
    shouldScrollToBottomRef.current = nearBottomRef.current;
    smoothScrollRef.current = true;
    if (!nearBottomRef.current) setHasNewMessages(true);
    onMessageRef.current?.(message, conversationRef.current?.participants.find((item) => item.userId === message.senderId)?.displayName);
    setMessages((current) => mergeMessages(current, [message]));
    if ((reactionEventVersionsRef.current.get(message.messageId) ?? 0) > (message.reactionVersion ?? 0)) queueReactionRefresh(message.messageId);
    setTotal((current) => current + 1);
    if (message.senderId === user?.id) {
      setLimitedMessagesRemaining((current) => current === null ? null : Math.max(0, current - 1));
    }
  }

  const canLoadOlder = total > (page + 1) * PAGE_SIZE;

  const loadOlder = async () => {
    if (!token || loadingOlder || !canLoadOlder) return;
    setLoadingOlder(true);
    setError('');
    try {
      const nextPage = page + 1;
      const response = await getMessages(conversationId, nextPage, PAGE_SIZE, token);
      const area = messageAreaRef.current;
      if (area) pendingOlderScrollRef.current = { height: area.scrollHeight, top: area.scrollTop };
      for (const message of response.items) knownMessageIds.current.add(message.messageId);
      setMessages((current) => mergeMessages(current, response.items.map((message) => applyReactionState(message, reactionStatesRef.current.get(message.messageId)))));
      for (const message of response.items) {
        if ((reactionEventVersionsRef.current.get(message.messageId) ?? 0) > (message.reactionVersion ?? 0)) queueReactionRefresh(message.messageId);
      }
      setTotal(response.total);
      setPage(response.page);
    } catch (loadError) {
      pendingOlderScrollRef.current = null;
      setError(loadError instanceof ApiError ? loadError.message : 'Unable to load older messages.');
    } finally {
      setLoadingOlder(false);
    }
  };

  const submitMessage = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH || !token || sendingRef.current || limitedMessagesRemaining === 0) return;
    sendingRef.current = true;
    setSending(true);
    setSendError('');
    setError('');
    shouldScrollToBottomRef.current = true;
    try {
      const savedMessage = await sendMessage(conversationId, { content, ...(replyTarget ? { replyToMessageId: replyTarget.messageId } : {}) }, token);
      if (!mountedRef.current) return;
      setReplyTarget((current) => current === replyTarget ? null : current);
      onMessageRef.current?.(savedMessage, user?.displayName);
      if (!knownMessageIds.current.has(savedMessage.messageId)) {
        knownMessageIds.current.add(savedMessage.messageId);
        setMessages((current) => mergeMessages(current, [savedMessage]));
        setTotal((current) => current + 1);
        setLimitedMessagesRemaining((current) => current === null ? null : Math.max(0, current - 1));
      }
      if (draftRef.current === draft) {
        stopTyping();
        draftRef.current = '';
        setDraft('');
      }
    } catch (sendFailure) {
      if (sendFailure instanceof ApiError && sendFailure.status === 400 && token) {
        // Another tab/account may have consumed the remaining quota.
        void getConversationDetail(conversationId, token).then((detail) => {
          setLimitedMessagesRemaining(detail.limitedMessagesRemaining ?? null);
        }).catch(() => {});
      }
      const reason = sendFailure instanceof ApiError ? sendFailure.message : 'Unable to send this message.';
      const uncertain = !(sendFailure instanceof ApiError) || sendFailure.status === undefined
        || sendFailure.status >= 500 || sendFailure.status < 400;
      setSendError(`${reason} Your draft is saved.${uncertain ? ' Check recent messages before sending again; the server may have saved it.' : ''}`);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (composingRef.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  };

  function updateTypingFromDraft(value: string) {
    draftRef.current = value;
    if (!value.trim() || loading || !conversation || limitedMessagesRemaining === 0 || document.visibilityState === 'hidden') {
      stopTyping();
      return;
    }
    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      if (token) publishTypingState(conversationId, token, 'START');
      typingRefreshTimerRef.current = setInterval(() => {
        if (token && draftRef.current.trim()) publishTypingState(conversationId, token, 'START');
      }, TYPING_REFRESH_MS);
    }
    if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
    typingIdleTimerRef.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  }

  function stopTyping() {
    if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
    if (typingRefreshTimerRef.current) clearInterval(typingRefreshTimerRef.current);
    typingIdleTimerRef.current = null;
    typingRefreshTimerRef.current = null;
    if (typingActiveRef.current && token) publishTypingState(conversationId, token, 'STOP');
    typingActiveRef.current = false;
  }

  function receiveTyping(event: ChatTypingEvent) {
    if (event.conversationId !== conversationId || event.senderId === user?.id) return;
    if (event.eventId !== undefined) {
      if (event.eventId <= (typingEventIdsRef.current.get(event.senderId) ?? 0)) return;
      typingEventIdsRef.current.set(event.senderId, event.eventId);
    }
    if (document.visibilityState === 'hidden') return;
    const previousTimer = typingExpiryTimersRef.current.get(event.senderId);
    if (previousTimer) clearTimeout(previousTimer);
    typingExpiryTimersRef.current.delete(event.senderId);
    if (event.state === 'STOP') {
      removeTypingUser(event.senderId);
      return;
    }
    const expiry = setTimeout(() => removeTypingUser(event.senderId), TYPING_EXPIRY_MS);
    typingExpiryTimersRef.current.set(event.senderId, expiry);
    setTypingNames((current) => current[event.senderId] === event.senderDisplayName
      ? current : { ...current, [event.senderId]: event.senderDisplayName });
  }

  function removeTypingUser(senderId: number) {
    const timer = typingExpiryTimersRef.current.get(senderId);
    if (timer) clearTimeout(timer);
    typingExpiryTimersRef.current.delete(senderId);
    setTypingNames((current) => {
      if (!(senderId in current)) return current;
      const next = { ...current };
      delete next[senderId];
      return next;
    });
  }

  function clearTypingExpiryTimers() {
    for (const timer of typingExpiryTimersRef.current.values()) clearTimeout(timer);
    typingExpiryTimersRef.current.clear();
  }

  function clearRemoteTyping() {
    clearTypingExpiryTimers();
    setTypingNames((current) => Object.keys(current).length ? {} : current);
  }

  const typingDisplayNames = Object.values(typingNames);
  const typingLabel = typingDisplayNames.length === 1
    ? `${typingDisplayNames[0]} is typing…`
    : typingDisplayNames.length === 2
      ? `${typingDisplayNames[0]} and ${typingDisplayNames[1]} are typing…`
      : typingDisplayNames.length > 2 ? 'Several people are typing…' : '';

  const typingPeople = typingDisplayNames.length === 1 ? typingDisplayNames[0]
    : typingDisplayNames.length === 2
      ? typingDisplayNames.join(' and ').length > 32 ? '2 people' : typingDisplayNames.join(' and ')
      : typingDisplayNames.length > 2 ? 'Several people' : '';
  const typingAction = typingDisplayNames.length === 1 ? 'is typing\u2026' : 'are typing\u2026';

  const isGroup = conversation?.type === 'GROUP';
  const participant = conversation?.participants.find((item) => item.userId !== user?.id);
  const title = isGroup ? group?.name ?? titleHint ?? 'Group' : participant?.displayName ?? titleHint ?? 'Conversation';
  const subtitle = isGroup ? `${group?.memberCount ?? conversation?.participants.length ?? 0} members`
    : participant ? `@${participant.username}` : 'Direct chat';
  const connectionLabel: Record<ChatConnectionState, string> = {
    connecting: 'Connecting…',
    connected: 'Live',
    reconnecting: 'Reconnecting…',
  };
  const statusLabel = isGroup ? connectionLabel[connection]
    : participantOnline === null ? presenceLoading ? 'Checking…' : 'Unavailable'
      : participantOnline ? 'Online' : 'Offline';

  return (
    <section className="chat-page" aria-label="Conversation">
      <header className="chat-header">
        <button className="quiet-light-button chat-back-button" type="button" onClick={onBack}>Back</button>
        <span className="chat-person-avatar">{title.charAt(0).toUpperCase()}</span>
        <span className="chat-person-details"><strong>{title}</strong><small>{subtitle}</small></span>
        {isGroup ? (
          <button className="quiet-light-button" type="button" aria-expanded={showInfo} onClick={() => setShowInfo((value) => !value)}>
            Group info
          </button>
        ) : null}
        {isGroup ? (
          <span className={connection === 'connected' ? 'connection-state connected' : 'connection-state'}><i />{statusLabel}</span>
        ) : (
          <span className={participantOnline === true ? 'presence-state online' : 'presence-state'} aria-live="polite"
            title="Authenticated realtime connectivity, not activity in this conversation.">
            <i />{statusLabel}
          </span>
        )}
      </header>
      {showInfo && isGroup && group && token ? (
        <GroupInfoPanel group={group} currentUserId={user?.id ?? null} token={token} onClose={() => setShowInfo(false)} onLeft={onLeftGroup}
          onOpenConversation={onOpenConversation}
          onGroupChanged={(updated) => { setGroup(updated); onGroupChanged(updated); }} />
      ) : null}
      {error && !conversation ? (
        <div className="chat-load-error" role="alert">{error}<Link to="/app/chat">Back to Messages</Link></div>
      ) : (
        <>
          <div className="chat-message-area" ref={messageAreaRef} onScroll={(event) => {
            const area = event.currentTarget;
            nearBottomRef.current = area.scrollHeight - area.scrollTop - area.clientHeight < 100;
            if (nearBottomRef.current) setHasNewMessages(false);
          }}>
            {loading ? <div className="result-state" role="status"><span className="spinner" />Loading messages…</div> : null}
            {!loading && error ? <div className="inline-error" role="alert">{error}<button type="button" onClick={() => void loadOlder()}>Try again</button></div> : null}
            {!loading && canLoadOlder ? <button className="load-older-button" type="button" onClick={() => void loadOlder()} disabled={loadingOlder}>{loadingOlder ? 'Loading older messages…' : 'Load older messages'}</button> : null}
            {!loading && messages.length === 0 ? <div className="chat-empty-state">No messages yet. Start the conversation.</div> : null}
            {messages.map((message) => {
              const outgoing = message.senderId === user?.id;
              const sender = isGroup && !outgoing
                ? conversation?.participants.find((item) => item.userId === message.senderId)?.displayName ?? 'Member'
                : null;
              return (
                <div className={outgoing ? 'chat-message-row outgoing' : 'chat-message-row incoming'} key={message.messageId} data-message-id={message.messageId} tabIndex={-1}>
                  <article className={outgoing ? 'chat-bubble outgoing-bubble' : 'chat-bubble incoming-bubble'}>
                    {sender ? <strong className="chat-sender">{sender}</strong> : null}
                    {message.replyToMessageId ? <button type="button" className="message-quote" onClick={() => {
                      const original = messageAreaRef.current?.querySelector<HTMLElement>(`[data-message-id="${message.replyToMessageId}"]`);
                      if (!original) { setActionFeedback('The original message is not loaded. Load older messages to find it.'); return; }
                      original.scrollIntoView?.({ block: 'center', behavior: 'auto' });
                      original.focus({ preventScroll: true });
                    }}>
                      <strong>{message.replyPreview?.senderDisplayName ?? 'Original message'}</strong>
                      <span>{message.replyPreview?.excerpt ?? 'Preview unavailable'}</span>
                    </button> : null}
                    <p>{message.content}</p>
                    <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                    <MessageActions message={message} busy={reactionBusy.has(message.messageId)}
                      onReact={(key, add) => void toggleReaction(message.messageId, key, add)}
                      onReply={() => {
                        setReplyTarget({ messageId: message.messageId,
                          senderDisplayName: conversation?.participants.find((item) => item.userId === message.senderId)?.displayName ?? 'Member',
                          excerpt: [...message.content].slice(0, 160).join('') });
                        requestAnimationFrame(() => composerRef.current?.focus());
                      }} />
                  </article>
                </div>
              );
            })}
          </div>
          {hasNewMessages ? <button className="jump-latest-button" type="button" onClick={() => {
            messageAreaRef.current?.scrollTo({ top: messageAreaRef.current.scrollHeight, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
            nearBottomRef.current = true;
            setHasNewMessages(false);
          }}>Jump to latest</button> : null}
          {sendError ? <div className="chat-send-error">
            <p role="alert">{sendError}</p>
            <button className="quiet-light-button compact-button" type="button" disabled={checkingRecent} onClick={async () => {
              if (!token || checkingRecent) return;
              setCheckingRecent(true);
              try {
                const response = await getMessages(conversationId, 0, PAGE_SIZE, token);
                for (const message of response.items) addMessage(message);
                setTotal(response.total);
              } catch {
                setSendError('Unable to check recent messages. Your draft is saved. Check the connection before sending again.');
              } finally { setCheckingRecent(false); }
            }}>{checkingRecent ? 'Checking recent messages...' : 'Check recent messages'}</button>
          </div> : null}
          <div className="typing-indicator" role="status" aria-label="Typing activity" title={typingLabel || undefined} aria-live="polite" aria-atomic="true">
            {typingPeople ? <><span className="typing-people">{typingPeople}</span>{' '}<span className="typing-action">{typingAction}</span></> : null}
          </div>
          {actionFeedback ? <div className="message-action-status" role="status">{actionFeedback}
            <button type="button" onClick={() => { setActionFeedback(''); void refreshReactions([...knownMessageIds.current]); }}>Refresh reactions</button>
          </div> : null}
          {replyTarget ? <div className="composer-reply" aria-label="Reply preview">
            <span><strong>Replying to {replyTarget.senderDisplayName}</strong><small>{replyTarget.excerpt}</small></span>
            <button type="button" aria-label="Cancel reply" onClick={() => { setReplyTarget(null); composerRef.current?.focus(); }}>×</button>
          </div> : null}
          <form className="chat-composer" onSubmit={(event) => void submitMessage(event)}>
            <label className="visually-hidden" htmlFor="chat-message">Message</label>
            <textarea ref={composerRef} id="chat-message" value={draft} onChange={(event) => {
              setDraft(event.target.value);
              updateTypingFromDraft(event.target.value);
            }} onKeyDown={handleComposerKeyDown}
              onBlur={stopTyping}
              onCompositionStart={() => { composingRef.current = true; }} onCompositionEnd={() => { composingRef.current = false; }}
              placeholder={limitedMessagesRemaining === 0 ? 'Message limit reached' : 'Write a message…'} maxLength={MAX_MESSAGE_LENGTH} rows={1}
              disabled={loading || !conversation || limitedMessagesRemaining === 0} />
            <button className="primary-button" type="submit" disabled={sending || loading || !conversation || !draft.trim() || limitedMessagesRemaining === 0}>{sending ? 'Sending…' : 'Send'}</button>
          </form>
          {limitedMessagesRemaining !== null ? <div className="limited-chat-notice">
            <p role="status">{limitedMessagesRemaining > 0 ? `${limitedMessagesRemaining} of 5 messages remaining.` : 'Message limit reached.'}</p>
            {!isGroup && participant && token ? <>
              <p>Become friends to chat without the message limit.</p>
              <LimitedChatFriendship conversationId={conversationId} participantId={participant.userId} token={token}
                onUnlocked={() => { setLimitedMessagesRemaining(null); setSendError(''); }} />
            </> : null}
          </div> : null}
        </>
      )}
    </section>
  );
}

export function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]) {
  const messagesById = new Map<number, ChatMessage>();
  for (const message of existing) messagesById.set(message.messageId, message);
  for (const message of incoming) {
    const previous = messagesById.get(message.messageId);
    messagesById.set(message.messageId, previous && (previous.reactionVersion ?? 0) > (message.reactionVersion ?? 0)
      ? { ...message, reactions: previous.reactions, reactionVersion: previous.reactionVersion } : message);
  }
  return [...messagesById.values()].sort(compareMessageOrder);
}
