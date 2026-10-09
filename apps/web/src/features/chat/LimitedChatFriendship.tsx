import { useCallback, useEffect, useRef, useState } from 'react';
import { getConversationDetail } from '../../api/chats';
import { ApiError } from '../../api/client';
import { acceptFriendRequest, getIncomingFriendRequests, getOutgoingFriendRequests, sendFriendRequest } from '../../api/friends';
import { useNotifications } from '../../app/providers/NotificationContext';

type Props = { conversationId: number; participantId: number; token: string; onUnlocked: () => void };
type RequestState = { type: 'none' | 'outgoing' } | { type: 'incoming'; requestId: number };

export function LimitedChatFriendship({ conversationId, participantId, token, onUnlocked }: Props) {
  const [request, setRequest] = useState<RequestState>({ type: 'none' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(true);
  const busyRef = useRef(false);
  const version = useRef(0);
  const unlockRef = useRef(onUnlocked);
  unlockRef.current = onUnlocked;
  const { notifications } = useNotifications();
  const friendshipEvent = notifications.find((item) => item.type === 'FRIEND_REQUEST_ACCEPTED' || item.type === 'FRIEND_REQUEST_RECEIVED')?.id;

  const refresh = useCallback(async (checkConversation = true) => {
    const currentVersion = ++version.current;
    setLoading(true);
    setError('');
    try {
      if (checkConversation) {
        const detail = await getConversationDetail(conversationId, token);
        if (!active.current || currentVersion !== version.current) return;
        if (detail.limitedMessagesRemaining == null) { unlockRef.current(); return; }
      }
      const [incoming, outgoing] = await Promise.all([getIncomingFriendRequests(token), getOutgoingFriendRequests(token)]);
      if (!active.current || currentVersion !== version.current) return;
      const received = incoming.items.find((item) => item.user.userId === participantId);
      setRequest(received ? { type: 'incoming', requestId: received.requestId }
        : { type: outgoing.items.some((item) => item.user.userId === participantId) ? 'outgoing' : 'none' });
    } catch (failure) {
      if (active.current && currentVersion === version.current) setError(failure instanceof ApiError ? failure.message : 'Unable to check friendship. Please try again.');
    } finally {
      if (active.current && currentVersion === version.current) setLoading(false);
    }
  }, [conversationId, participantId, token]);

  useEffect(() => {
    active.current = true;
    void refresh(false);
    return () => { active.current = false; version.current += 1; };
  }, [refresh]);

  useEffect(() => {
    if (friendshipEvent !== undefined) void refresh();
  }, [friendshipEvent, refresh]);

  useEffect(() => {
    const onFocus = () => { if (!busyRef.current) void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const handleAction = async () => {
    if (busyRef.current || loading || error || request.type === 'outgoing') return;
    busyRef.current = true;
    version.current += 1;
    setBusy(true);
    setError('');
    try {
      if (request.type === 'incoming') {
        await acceptFriendRequest(request.requestId, token);
        if (active.current) unlockRef.current();
      } else {
        await sendFriendRequest(participantId, token);
        if (active.current) setRequest({ type: 'outgoing' });
      }
    } catch (failure) {
      if (active.current) {
        setError(failure instanceof ApiError ? failure.message : 'Unable to update friendship. Please try again.');
        // A request may have changed in another tab; the refresh action reconciles it.
      }
    } finally {
      busyRef.current = false;
      if (active.current) setBusy(false);
    }
  };

  return <div className="limited-chat-friendship">
    {error ? <span role="alert">{error}</span> : null}
    {loading ? <span>Checking friendship...</span> : request.type === 'outgoing'
      ? <span role="status">Friend request sent. Waiting for acceptance.</span>
      : <button className="primary-button compact-button" type="button" disabled={busy || !!error} onClick={() => void handleAction()}>
        {busy ? 'Working...' : request.type === 'incoming' ? 'Accept friend request' : 'Add friend'}
      </button>}
    <button className="quiet-light-button compact-button" type="button" disabled={loading || busy} onClick={() => void refresh()}>Refresh friendship</button>
  </div>;
}
