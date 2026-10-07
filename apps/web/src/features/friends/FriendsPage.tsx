import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  getFriends,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  rejectFriendRequest,
} from '../../api/friends';
import { openDirectConversation } from '../../api/chats';
import { ApiError } from '../../api/client';
import { useAuth } from '../../app/providers/AuthContext';
import { FriendRelationship, FriendRequestItem, FriendSummary } from '../../types';

type FriendsTab = 'friends' | 'incoming' | 'outgoing';
const validTabs: FriendsTab[] = ['friends', 'incoming', 'outgoing'];

export function FriendsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') as FriendsTab | null;
  const activeTab = requestedTab && validTabs.includes(requestedTab) ? requestedTab : 'friends';
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = async (initial = false) => {
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setLoading(false);
      return;
    }
    initial ? setLoading(true) : setRefreshing(true);
    setError('');
    try {
      const [friendResponse, incomingResponse, outgoingResponse] = await Promise.all([
        getFriends(token),
        getIncomingFriendRequests(token),
        getOutgoingFriendRequests(token),
      ]);
      setFriends(friendResponse.items);
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
  }, [token]);

  const selectTab = (tab: FriendsTab) => {
    setSearchParams(tab === 'friends' ? {} : { tab }, { replace: true });
  };

  const runRequestAction = async (request: FriendRequestItem, action: 'accept' | 'reject' | 'cancel') => {
    if (!token || busyIds.includes(request.requestId)) return;
    setBusyIds((ids) => [...ids, request.requestId]);
    setError('');
    setNotice('');
    try {
      if (action === 'accept') {
        await acceptFriendRequest(request.requestId, token);
        setIncoming((items) => items.filter((item) => item.requestId !== request.requestId));
        setFriends((items) => items.some((friend) => friend.userId === request.user.userId)
          ? items
          : [...items, request.user]);
        setNotice(`You and ${request.user.displayName} are now friends.`);
      } else if (action === 'reject') {
        await rejectFriendRequest(request.requestId, token);
        setIncoming((items) => items.filter((item) => item.requestId !== request.requestId));
        setNotice('Friend request rejected.');
      } else {
        await cancelFriendRequest(request.requestId, token);
        setOutgoing((items) => items.filter((item) => item.requestId !== request.requestId));
        setNotice('Friend request cancelled.');
      }
    } catch (actionError) {
      setError(actionError instanceof ApiError ? actionError.message : 'Unable to update this request.');
    } finally {
      setBusyIds((ids) => ids.filter((id) => id !== request.requestId));
    }
  };

  const openChat = async (friend: FriendSummary) => {
    if (!token || openingId !== null) return;
    setOpeningId(friend.userId);
    setError('');
    try {
      const conversation = await openDirectConversation(friend.userId, token);
      navigate(`/app/chat/${conversation.conversationId}`);
    } catch (chatError) {
      setError(chatError instanceof ApiError ? chatError.message : 'Unable to open this conversation.');
    } finally {
      setOpeningId(null);
    }
  };

  const countForTab = activeTab === 'friends' ? friends.length : activeTab === 'incoming' ? incoming.length : outgoing.length;

  return (
    <section className="page-content friends-page">
      <div className="page-heading">
        <div><p className="eyebrow">YOUR CIRCLE</p><h1>Friends</h1></div>
        <button className="quiet-light-button" type="button" onClick={() => void refresh()} disabled={loading || refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <p className="page-intro">Keep up with your people and the requests waiting for you.</p>
      <div className="segmented-tabs" role="tablist" aria-label="Friend lists">
        {([
          ['friends', 'Friends', friends.length],
          ['incoming', 'Incoming', incoming.length],
          ['outgoing', 'Sent', outgoing.length],
        ] as const).map(([tab, label, count]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? 'segmented-tab selected' : 'segmented-tab'}
            onClick={() => selectTab(tab)}
          >
            {label}<span>{count}</span>
          </button>
        ))}
      </div>
      {error ? <div className="inline-error" role="alert">{error}<button type="button" onClick={() => void refresh(true)}>Try again</button></div> : null}
      {notice ? <p className="inline-notice" role="status">{notice}</p> : null}
      {loading ? (
        <div className="result-state" role="status"><span className="spinner" />Loading {activeTab}…</div>
      ) : countForTab === 0 ? (
        <div className="result-state empty-state">
          {activeTab === 'friends' ? 'No friends yet. Search for people to connect.' : activeTab === 'incoming' ? 'No incoming requests.' : 'No outgoing requests.'}
          {activeTab === 'friends' ? <Link to="/app/search">Search people</Link> : null}
        </div>
      ) : (
        <div className="results-list" aria-label={`${activeTab} list`}>
          {activeTab === 'friends' ? friends.map((friend) => (
            <article className="person-row friend-row" key={friend.userId}>
              <span className="person-avatar">{friend.displayName.charAt(0).toUpperCase()}</span>
              <span className="person-details"><strong>{friend.displayName}</strong><small>@{friend.username}</small></span>
              <button className="primary-button compact-button" type="button" onClick={() => void openChat(friend)} disabled={openingId !== null}>
                {openingId === friend.userId ? 'Opening…' : 'Chat'}
              </button>
            </article>
          )) : (activeTab === 'incoming' ? incoming : outgoing).map((request) => (
            <FriendRequestRow
              key={request.requestId}
              request={request}
              direction={activeTab}
              busy={busyIds.includes(request.requestId)}
              onAction={(action) => void runRequestAction(request, action)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function FriendRequestRow({
  request,
  direction,
  busy,
  onAction,
}: {
  request: FriendRequestItem;
  direction: 'incoming' | 'outgoing';
  busy: boolean;
  onAction: (action: 'accept' | 'reject' | 'cancel') => void;
}) {
  return (
    <article className="person-row friend-row" key={request.requestId}>
      <span className="person-avatar">{request.user.displayName.charAt(0).toUpperCase()}</span>
      <span className="person-details"><strong>{request.user.displayName}</strong><small>@{request.user.username}</small></span>
      {direction === 'incoming' ? (
        <span className="request-actions">
          <button className="primary-button compact-button" type="button" onClick={() => onAction('accept')} disabled={busy}>{busy ? 'Saving…' : 'Accept'}</button>
          <button className="quiet-light-button compact-button" type="button" onClick={() => onAction('reject')} disabled={busy}>Reject</button>
        </span>
      ) : <button className="quiet-light-button compact-button" type="button" onClick={() => onAction('cancel')} disabled={busy}>{busy ? 'Cancelling…' : 'Cancel'}</button>}
    </article>
  );
}