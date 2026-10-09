import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getConversationDetail, getConversations, openDirectConversation } from '../../api/chats';
import { ApiError } from '../../api/client';
import { getFriends } from '../../api/friends';
import { getGroup } from '../../api/groups';
import { useAuth } from '../../app/providers/AuthContext';
import { subscribeToConversationActivity, subscribeToGroupEvents } from '../../services/chatWebSocket';
import { ChatMessage, Conversation, ConversationUser, FriendSummary, GroupInfo } from '../../types';
import { ChatPanel } from './ChatPanel';
import { CreateGroupForm } from './CreateGroupForm';
import { activityTime, formatConversationTime, updateConversation } from './messagePresentation';

export function MessagesPage() {
  const { conversationId: routeId } = useParams();
  const selectedId = routeId === undefined ? null : Number(routeId);
  const selectedIdRef = useRef<number | null>(selectedId);
  selectedIdRef.current = selectedId;
  const navigate = useNavigate();
  // useNavigate changes identity on every route change; keep it out of effect/callback deps.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const { token, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [groups, setGroups] = useState<Record<number, GroupInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingUserId, setOpeningUserId] = useState<number | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [query, setQuery] = useState('');
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const loadVersion = useRef(0);
  const removedIds = useRef(new Set<number>());
  const accountTokenRef = useRef(token);
  accountTokenRef.current = token;

  const load = useCallback(async (clearMissingSelection = false) => {
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setLoading(false);
      return;
    }
    const version = ++loadVersion.current;
    setError('');
    try {
      const [conversationResponse, friendResponse] = await Promise.all([getConversations(token), getFriends(token)]);
      if (version !== loadVersion.current || accountTokenRef.current !== token) return;
      const activeConversationId = selectedIdRef.current;
      if (clearMissingSelection && activeConversationId !== null
        && !conversationResponse.items.some((item) => item.conversationId === activeConversationId)) {
        navigateRef.current('/app/chat');
      }
      const groupConversations = conversationResponse.items.filter((item) => item.type === 'GROUP' && !item.groupName);
      const groupResults = await Promise.allSettled(groupConversations.map((item) => getGroup(item.conversationId, token)));
      const groupById: Record<number, GroupInfo> = {};
      groupResults.forEach((result, index) => {
        if (result.status === 'fulfilled') groupById[groupConversations[index].conversationId] = result.value;
      });
      if (version !== loadVersion.current || accountTokenRef.current !== token) return;
      setConversations((current) => {
        const liveById = new Map(current.map((item) => [item.conversationId, item]));
        return conversationResponse.items.filter((item) => !removedIds.current.has(item.conversationId)).map((item) => {
        const live = liveById.get(item.conversationId);
        return live?.lastMessageAt && (activityTime(live) > activityTime(item) || (activityTime(live) === activityTime(item) && (live.lastMessageId ?? 0) > (item.lastMessageId ?? 0)))
          ? { ...item, lastMessage: live.lastMessage, lastMessageAt: live.lastMessageAt, lastMessageId: live.lastMessageId, lastMessageSender: live.lastMessageSender } : item;
        });
      });
      setFriends(friendResponse.items);
      setGroups((current) => {
        const next = { ...groupById };
        for (const item of conversationResponse.items) {
          const cached = current[item.conversationId];
          if (!removedIds.current.has(item.conversationId) && cached
            && (!item.groupName || cached.name === item.groupName || Date.parse(cached.updatedAt) > Date.parse(item.updatedAt))) {
            next[item.conversationId] = cached;
          }
        }
        return next;
      });
    } catch (loadError) {
      if (version !== loadVersion.current || accountTokenRef.current !== token) return;
      setError(loadError instanceof ApiError ? loadError.message : 'Unable to load conversations right now.');
    } finally {
      if (version === loadVersion.current && accountTokenRef.current === token) setLoading(false);
    }
  }, [token]);

  const refreshConversations = useCallback(async () => {
    if (!token) return;
    try {
      const response = await getConversations(token);
      if (accountTokenRef.current !== token) return;
      setConversations((current) => {
        const byId = new Map(current.map((item) => [item.conversationId, item]));
        return response.items.filter((item) => !removedIds.current.has(item.conversationId)).map((item) => {
          const live = byId.get(item.conversationId);
          return live?.lastMessageAt && activityTime(live) > activityTime(item)
            ? { ...item, lastMessage: live.lastMessage, lastMessageAt: live.lastMessageAt,
              lastMessageId: live.lastMessageId, lastMessageSender: live.lastMessageSender } : item;
        });
      });
    } catch {
      // The list is refreshed again on the next full load.
    }
  }, [token]);

  const applyGroup = useCallback((group: GroupInfo) => setGroups((current) => {
    if (removedIds.current.has(group.groupId)) return current;
    const previous = current[group.groupId];
    if (previous && previous.name === group.name && previous.memberCount === group.memberCount
      && previous.updatedAt === group.updatedAt) return current;
    return { ...current, [group.groupId]: group };
  }), []);

  useEffect(() => {
    setLoading(true);
    removedIds.current.clear();
    void load();
    return () => { loadVersion.current += 1; };
  }, [load]);

  useEffect(() => {
    if (!token) return undefined;
    let hasConnected = false;
    return subscribeToGroupEvents(token, {
      onStateChange: (state) => {
        if (state === 'connected') {
          if (hasConnected) void load(true);
          hasConnected = true;
        }
      },
      onEvent: (event) => {
        if (event.type === 'GROUP_DELETED') {
          const groupId = event.group.groupId;
          removedIds.current.add(groupId);
          setGroups((current) => {
            const { [groupId]: _removed, ...rest } = current;
            return rest;
          });
          setConversations((current) => current.filter((item) => item.conversationId !== groupId));
          if (selectedIdRef.current === groupId) navigateRef.current('/app/chat');
          return;
        }
        if (event.type === 'MEMBER_ADDED' && event.member?.user.userId === user?.id) removedIds.current.delete(event.group.groupId);
        applyGroup(event.group);
        const leftCurrentGroup = (event.type === 'MEMBER_REMOVED' || event.type === 'MEMBER_LEFT')
          && event.member?.user.userId === user?.id;
        const joinedCurrentGroup = event.type === 'MEMBER_ADDED' && event.member?.user.userId === user?.id;
        if (leftCurrentGroup) {
          removedIds.current.add(event.group.groupId);
          setConversations((current) => current.filter((item) => item.conversationId !== event.group.groupId));
          if (selectedIdRef.current === event.group.groupId) navigateRef.current('/app/chat');
        } else if (joinedCurrentGroup) {
          void load();
        }
      },
    });
  }, [applyGroup, load, token, user?.id]);

  const openFriend = async (friend: ConversationUser) => {
    if (!token || openingUserId !== null) return;
    setOpeningUserId(friend.userId);
    setError('');
    try {
      const opened = await openDirectConversation(friend.userId, token);
      setConversations((current) => current.some((item) => item.conversationId === opened.conversationId) ? current : [{
        conversationId: opened.conversationId, type: 'DIRECT', participant: friend,
        updatedAt: opened.updatedAt ?? '', lastMessage: null,
      }, ...current]);
      navigate(`/app/chat/${opened.conversationId}`);
    } catch (openError) {
      setError(openError instanceof ApiError ? openError.message : 'Unable to open this conversation.');
    } finally {
      setOpeningUserId(null);
    }
  };

  const directConversations = conversations.filter((item) => item.type === 'DIRECT');
  const entries = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return conversations.filter((item) => (item.type === 'GROUP'
      ? groups[item.conversationId]?.name ?? item.groupName ?? 'Group'
      : item.participant.displayName).toLocaleLowerCase().includes(search))
      .sort((a, b) => activityTime(b) - activityTime(a) || a.conversationId - b.conversationId);
  }, [conversations, groups, query]);
  const newFriends = useMemo(() => {
    const known = new Set(conversations.filter((item) => item.type === 'DIRECT').map((item) => item.participant.userId));
    return friends.filter((friend) => !known.has(friend.userId)
      && friend.displayName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  }, [conversations, friends, query]);
  const hasSelection = selectedId !== null;
  const isEmpty = !loading && !error && entries.length === 0 && newFriends.length === 0;

  const applyMessage = useCallback((message: ChatMessage, sender?: string) => {
    setConversations((current) => {
      let changed = false;
      const next = current.map((item) => {
        const updated = updateConversation(item, message, sender);
        changed ||= updated !== item;
        return updated;
      });
      return changed ? next : current;
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const pending = new Map<number, { message: ChatMessage; sender: string }>();
    const unsubscribe = subscribeToConversationActivity(token, {
      onStateChange: () => {}, // Group-event subscription performs one reconnect reconciliation.
      onActivity: (message, sender) => {
        if (!active || removedIds.current.has(message.conversationId)) return;
        if (conversationsRef.current.some((item) => item.conversationId === message.conversationId)) {
          applyMessage(message, sender);
        } else {
          const alreadyLoading = pending.has(message.conversationId);
          pending.set(message.conversationId, { message, sender });
          if (alreadyLoading) return;
          void getConversationDetail(message.conversationId, token).then((detail) => {
            if (!active || removedIds.current.has(message.conversationId)) return;
            const latest = pending.get(message.conversationId);
            if (!latest) return;
            message = latest.message;
            sender = latest.sender;
            const participant = detail.participants.find((member) => member.userId !== user?.id)
              ?? detail.participants[0];
            if (!participant) return;
            setConversations((current) => current.some((item) => item.conversationId === message.conversationId)
              ? current.map((item) => updateConversation(item, message, sender))
              : [...current, updateConversation({ conversationId: detail.conversationId, type: detail.type,
                participant, updatedAt: detail.updatedAt, lastMessage: null }, message, sender)]);
            if (detail.type === 'GROUP') void getGroup(detail.conversationId, token).then((group) => {
              if (active) applyGroup(group);
            }).catch(() => {});
          }).catch(() => {}).finally(() => pending.delete(message.conversationId));
        }
      },
    });
    return () => { active = false; unsubscribe(); };
  }, [token, user?.id, applyGroup, applyMessage]);

  const closeConversation = () => navigate('/app/chat');
  const handleLeftGroup = () => { navigate('/app/chat'); void load(); };
  const selectedGroup = selectedId === null ? undefined : groups[selectedId];
  const selectedDirect = selectedId === null ? undefined
    : directConversations.find((item) => item.conversationId === selectedId);
  const titleHint = selectedGroup?.name ?? conversations.find((item) => item.conversationId === selectedId)?.groupName ?? selectedDirect?.participant.displayName;

  return (
    <section className="page-content messages-page">
      <div className="page-heading"><div><p className="eyebrow">YOUR CONVERSATIONS</p><h1>Messages</h1></div></div>
      <div className={hasSelection ? 'messages-layout has-selection' : 'messages-layout'}>
        <aside className="conversation-sidebar" aria-label="Friends and conversations">
          <div className="sidebar-toolbar">
            <strong>Friends / Chats</strong>
            <button className="quiet-light-button compact-button" type="button" onClick={() => setCreatingGroup((value) => !value)} aria-expanded={creatingGroup}>
              Create group
            </button>
          </div>
          <div className="conversation-search">
            <label className="visually-hidden" htmlFor="conversation-search">Search conversations</label>
            <input id="conversation-search" type="search" placeholder="Search conversations..." value={query} onChange={(event) => setQuery(event.target.value)} />
            {query ? <button type="button" className="quiet-light-button" onClick={() => setQuery('')}>Clear search</button> : null}
          </div>
          {creatingGroup && token ? (
            <CreateGroupForm friends={friends} currentUserId={user?.id ?? null} token={token}
              onCancel={() => setCreatingGroup(false)}
              onCreated={(groupId) => { setCreatingGroup(false); navigate(`/app/chat/${groupId}`); void load(); }} />
          ) : null}
          {error ? <div className="inline-error" role="alert">{error}<button type="button" onClick={() => { setLoading(true); void load(); }}>Try again</button></div> : null}
          {loading ? <div className="result-state" role="status"><span className="spinner" />Loading conversations…</div> : null}
          {isEmpty ? <div className="result-state empty-state">{query.trim() ? 'No conversations match your search.' : <>No conversations yet. Add friends to start chatting. <Link to="/app/friends">Find friends</Link></>}</div> : null}
          <div className="conversation-section">
            {entries.map((item) => {
              const title = item.type === 'GROUP' ? groups[item.conversationId]?.name ?? item.groupName ?? 'Group' : item.participant.displayName;
              const timestamp = item.lastMessageAt ?? item.updatedAt;
              const preview = item.lastMessage == null ? 'No messages yet'
                : item.type === 'GROUP' && item.lastMessageSender ? `${item.lastMessageSender}: ${item.lastMessage}` : item.lastMessage;
              return <Link key={item.conversationId} to={`/app/chat/${item.conversationId}`}
                className={selectedId === item.conversationId ? 'conversation-row selected' : 'conversation-row'}
                aria-current={selectedId === item.conversationId ? 'page' : undefined}>
                <span className="person-avatar">{title.charAt(0).toUpperCase()}</span>
                <span className="person-details"><strong>{title}</strong><span className="conversation-preview">{preview}</span></span>
                <time className="conversation-date" dateTime={timestamp}>{formatConversationTime(timestamp)}</time>
              </Link>;
            })}
            {newFriends.map((friend) => <button key={friend.userId} type="button" className="conversation-row"
              onClick={() => void openFriend(friend)} disabled={openingUserId !== null}>
              <span className="person-avatar">{friend.displayName.charAt(0).toUpperCase()}</span>
              <span className="person-details"><strong>{friend.displayName}</strong><span className="conversation-preview">
                {openingUserId === friend.userId ? 'Opening...' : 'Start a conversation'}
              </span></span>
            </button>)}
          </div>
        </aside>
        <div className="chat-panel-area">
          {selectedId !== null ? (
            <ChatPanel key={selectedId} conversationId={selectedId} groupInfo={groups[selectedId] ?? null} titleHint={titleHint}
              onBack={closeConversation} onLeftGroup={handleLeftGroup}
              onGroupChanged={applyGroup} onMessage={applyMessage}
              onOpenConversation={(id) => { navigate(`/app/chat/${id}`); void refreshConversations(); }} />
          ) : (
            <div className="chat-panel-empty"><strong>Select a friend or group</strong><span>to start chatting.</span></div>
          )}
        </div>
      </div>
    </section>
  );
}
