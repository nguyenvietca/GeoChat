import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getConversations } from '../../api/chats';
import { ApiError } from '../../api/client';
import { useAuth } from '../../app/providers/AuthContext';
import { Conversation } from '../../types';

export function ConversationListPage() {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await getConversations(token);
      setConversations(response.items.filter((conversation) => conversation.type === 'DIRECT'));
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'Unable to load conversations right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  return (
    <section className="page-content">
      <div className="page-heading"><div><p className="eyebrow">YOUR CONVERSATIONS</p><h1>Messages</h1></div></div>
      <p className="page-intro">Continue a conversation with a friend.</p>
      {error ? <div className="inline-error" role="alert">{error}<button type="button" onClick={() => void load()}>Try again</button></div> : null}
      {loading ? <div className="result-state" role="status"><span className="spinner" />Loading conversations…</div> : null}
      {!loading && !error && conversations.length === 0 ? (
        <div className="result-state empty-state">No conversations yet. Open a chat from <Link to="/app/friends">Friends</Link>.</div>
      ) : null}
      {!loading && conversations.length > 0 ? (
        <div className="results-list" aria-label="Conversations">
          {conversations.map((conversation) => (
            <Link className="conversation-row" to={`/app/chat/${conversation.conversationId}`} key={conversation.conversationId}>
              <span className="person-avatar">{conversation.participant.displayName.charAt(0).toUpperCase()}</span>
              <span className="person-details">
                <strong>{conversation.participant.displayName}</strong>
                <small>@{conversation.participant.username}</small>
                <span className="conversation-preview">{conversation.lastMessage ?? 'No messages yet'}</span>
              </span>
              <time className="conversation-date" dateTime={conversation.updatedAt}>{formatDate(conversation.updatedAt)}</time>
              <span className="conversation-arrow" aria-hidden="true">›</span>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}