import { FormEvent, KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getConversationDetail, getConversationPresence, getMessages, sendMessage } from '../../api/chats';
import { ApiError } from '../../api/client';
import { getGroup } from '../../api/groups';
import { useAuth } from '../../app/providers/AuthContext';
import { ChatConnectionState, subscribeToConversation, subscribeToPresence } from '../../services/chatWebSocket';
import { ChatMessage, ConversationDetail, GroupInfo } from '../../types';
import { formatMessageTime } from './messagePresentation';
import { LimitedChatFriendship } from './LimitedChatFriendship';
import { GroupInfoPanel } from './GroupInfoPanel';

const PAGE_SIZE = 20;
const MAX_MESSAGE_LENGTH = 5000;

type ChatPanelProps = {
  conversationId: number;
  groupInfo: GroupInfo | null;
  titleHint?: string;
  onMessage?: (message: ChatMessage, sender?: string) => void;
  onBack: () => void;
  onLeftGroup: () => void;
  onGroupChanged: (group: GroupInfo) => void;
  onOpenConversation: (conversationId: number) => void;
};

// Rendered with key={conversationId} so switching conversations resets all state and subscriptions.
export function ChatPanel({ conversationId, groupInfo, titleHint, onBack, onLeftGroup, onGroupChanged, onOpenConversation, onMessage }: ChatPanelProps) {
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
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');
  const [checkingRecent, setCheckingRecent] = useState(false);
  const [connection, setConnection] = useState<ChatConnectionState>('connecting');
  const [participantOnline, setParticipantOnline] = useState<boolean | null>(null);
  const [presenceLoading, setPresenceLoading] = useState(false);
  const messageAreaRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const shouldScrollToBottomRef = useRef(true);
  const smoothScrollRef = useRef(false);
  const pendingOlderScrollRef = useRef<{ height: number; top: number } | null>(null);
  const sendingRef = useRef(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;
  const knownMessageIds = useRef(new Set<number>());

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
      setMessages((current) => mergeMessages(current, response.items));
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
        setConnection(state);
        if (state === 'connected') {
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
      onMessage: addMessage,
    });
    return () => { active = false; unsubscribe(); };
  }, [conversationId, token]);

  useLayoutEffect(() => {
    const area = messageAreaRef.current;
    if (!area) return;
    const previous = pendingOlderScrollRef.current;
    if (previous) {
      area.scrollTop = previous.top + (area.scrollHeight - previous.height);
      pendingOlderScrollRef.current = null;
    } else if (shouldScrollToBottomRef.current) {
      if (smoothScrollRef.current && typeof area.scrollTo === 'function') {
        area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' });
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
      setMessages((current) => mergeMessages(current, response.items));
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
      const savedMessage = await sendMessage(conversationId, { content }, token);
      onMessageRef.current?.(savedMessage, user?.displayName);
      if (!knownMessageIds.current.has(savedMessage.messageId)) {
        knownMessageIds.current.add(savedMessage.messageId);
        setMessages((current) => mergeMessages(current, [savedMessage]));
        setTotal((current) => current + 1);
        setLimitedMessagesRemaining((current) => current === null ? null : Math.max(0, current - 1));
      }
      setDraft((current) => current === draft ? '' : current);
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
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  };

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
          <span className={participantOnline === true ? 'presence-state online' : 'presence-state'} aria-live="polite">
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
                <div className={outgoing ? 'chat-message-row outgoing' : 'chat-message-row incoming'} key={message.messageId}>
                  <article className={outgoing ? 'chat-bubble outgoing-bubble' : 'chat-bubble incoming-bubble'}>
                    {sender ? <strong className="chat-sender">{sender}</strong> : null}
                    <p>{message.content}</p>
                    <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                  </article>
                </div>
              );
            })}
          </div>
          {hasNewMessages ? <button className="jump-latest-button" type="button" onClick={() => {
            messageAreaRef.current?.scrollTo({ top: messageAreaRef.current.scrollHeight, behavior: 'smooth' });
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
          <form className="chat-composer" onSubmit={(event) => void submitMessage(event)}>
            <label className="visually-hidden" htmlFor="chat-message">Message</label>
            <textarea id="chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown}
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
  for (const message of incoming) messagesById.set(message.messageId, message);
  return [...messagesById.values()].sort((first, second) => {
    const delta = Date.parse(first.createdAt) - Date.parse(second.createdAt);
    return delta || first.messageId - second.messageId;
  });
}
