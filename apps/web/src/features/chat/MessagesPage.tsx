import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getConversations, openDirectConversation } from '../../api/chats';
import { ApiError } from '../../api/client';
import { getFriends } from '../../api/friends';
import { getGroup } from '../../api/groups';
import { useAuth } from '../../app/providers/AuthContext';
import { Conversation, ConversationUser, FriendSummary, GroupInfo } from '../../types';
import { ChatPanel } from './ChatPanel';
import { CreateGroupForm } from './CreateGroupForm';

type DirectEntry = { key: string; user: ConversationUser; conversationId: number | null; preview: string | null; updatedAt: string | null };

export function MessagesPage() {
  const { conversationId: routeId } = useParams();
  const selectedId = routeId === undefined ? null : Number(routeId);
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [groups, setGroups] = useState<Record<number, GroupInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingUserId, setOpeningUserId] = useState<number | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setLoading(false);
      return;
    }
    setError('');
    try {
      const [conversationResponse, friendResponse] = await Promise.all([getConversations(token), getFriends(token)]);
      const groupConversations = conversationResponse.items.filter((item) => item.type === 'GROUP');
      const groupResults = await Promise.allSettled(groupConversations.map((item) => getGroup(item.conversationId, token)));
      const groupById: Record<number, GroupInfo> = {};
      groupResults.forEach((result, index) => {
        if (result.status === 'fulfilled') groupById[groupConversations[index].conversationId] = result.value;
      });
      setConversations(conversationResponse.items);
      setFriends(friendResponse.items);
      setGroups(groupById);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'Unable to load conversations right now.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const openFriend = async (friend: ConversationUser) => {
    if (!token || openingUserId !== null) return;
    setOpeningUserId(friend.userId);
    setError('');
    try {
      const opened = await openDirectConversation(friend.userId, token);
      navigate(`/app/chat/${opened.conversationId}`);
      void load();
    } catch (openError) {
      setError(openError instanceof ApiError ? openError.message : 'Unable to open this conversation.');
    } finally {
      setOpeningUserId(null);
    }
  };

  const groupEntries = conversations.filter((item) => item.type === 'GROUP' && groups[item.conversationId]);
  const directConversations = conversations.filter((item) => item.type === 'DIRECT');
  const knownUserIds = new Set(directConversations.map((item) => item.participant.userId));
  const directEntries: DirectEntry[] = [
    ...directConversations.map((item) => ({
      key: `c-${item.conversationId}`, user: item.participant, conversationId: item.conversationId,
      preview: item.lastMessage, updatedAt: item.updatedAt,
    })),
    ...friends.filter((friend) => !knownUserIds.has(friend.userId)).map((friend) => ({
      key: `f-${friend.userId}`, user: friend, conversationId: null, preview: null, updatedAt: null,
    })),
  ];
  const hasSelection = selectedId !== null;
  const isEmpty = !loading && !error && groupEntries.length === 0 && directEntries.length === 0;

  const closeConversation = () => navigate('/app/chat');
  const handleLeftGroup = () => { navigate('/app/chat'); void load(); };

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
          {creatingGroup && token ? (
            <CreateGroupForm friends={friends} currentUserId={user?.id ?? null} token={token}
              onCancel={() => setCreatingGroup(false)}
              onCreated={(groupId) => { setCreatingGroup(false); navigate(`/app/chat/${groupId}`); void load(); }} />
          ) : null}
          {error ? <div className="inline-error" role="alert">{error}<button type="button" onClick={() => { setLoading(true); void load(); }}>Try again</button></div> : null}
          {loading ? <div className="result-state" role="status"><span className="spinner" />Loading conversations…</div> : null}
          {isEmpty ? <div className="result-state empty-state">No conversations yet. Add friends to start chatting. <Link to="/app/friends">Find friends</Link></div> : null}
          {groupEntries.length > 0 ? (
            <div className="conversation-section">
              <h2>Groups</h2>
              {groupEntries.map((item) => {
                const group = groups[item.conversationId];
                return (
                  <Link key={item.conversationId} to={`/app/chat/${item.conversationId}`}
                    className={selectedId === item.conversationId ? 'conversation-row selected' : 'conversation-row'}
                    aria-current={selectedId === item.conversationId ? 'page' : undefined}>
                    <span className="person-avatar">{group.name.charAt(0).toUpperCase()}</span>
                    <span className="person-details"><strong>{group.name}</strong><span className="conversation-preview">{item.lastMessage ?? 'No messages yet'}</span></span>
                    <time className="conversation-date" dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time>
                  </Link>
                );
              })}
            </div>
          ) : null}
          {directEntries.length > 0 ? (
            <div className="conversation-section">
              <h2>Friends</h2>
              {directEntries.map((entry) => entry.conversationId !== null ? (
                <Link key={entry.key} to={`/app/chat/${entry.conversationId}`}
                  className={selectedId === entry.conversationId ? 'conversation-row selected' : 'conversation-row'}
                  aria-current={selectedId === entry.conversationId ? 'page' : undefined}>
                  <span className="person-avatar">{entry.user.displayName.charAt(0).toUpperCase()}</span>
                  <span className="person-details"><strong>{entry.user.displayName}</strong><span className="conversation-preview">{entry.preview ?? 'No messages yet'}</span></span>
                  {entry.updatedAt ? <time className="conversation-date" dateTime={entry.updatedAt}>{formatDate(entry.updatedAt)}</time> : null}
                </Link>
              ) : (
                <button key={entry.key} type="button" className="conversation-row" onClick={() => void openFriend(entry.user)} disabled={openingUserId !== null}>
                  <span className="person-avatar">{entry.user.displayName.charAt(0).toUpperCase()}</span>
                  <span className="person-details"><strong>{entry.user.displayName}</strong><span className="conversation-preview">{openingUserId === entry.user.userId ? 'Opening…' : 'Start a conversation'}</span></span>
                </button>
              ))}
            </div>
          ) : null}
        </aside>
        <div className="chat-panel-area">
          {selectedId !== null ? (
            <ChatPanel key={selectedId} conversationId={selectedId} onBack={closeConversation} onLeftGroup={handleLeftGroup} />
          ) : (
            <div className="chat-panel-empty"><strong>Select a friend or group</strong><span>to start chatting.</span></div>
          )}
        </div>
      </div>
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
