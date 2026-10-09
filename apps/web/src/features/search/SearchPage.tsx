import { FormEvent, useState } from 'react';
import { searchUsers } from '../../api/users';
import { sendFriendRequest } from '../../api/friends';
import { openDiscoveryConversation, openDirectConversation } from '../../api/chats';
import { ApiError } from '../../api/client';
import { useAuth } from '../../app/providers/AuthContext';
import { useNavigate } from 'react-router-dom';
import { UserSearchResult } from '../../types';

export function SearchPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) {
      setError('Enter at least 2 characters to search.');
      setResults([]);
      setHasSearched(false);
      return;
    }
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await searchUsers(cleanQuery, token);
      setResults(response.items);
      setHasSearched(true);
      setNotice('');
    } catch (searchError) {
      setResults([]);
      setHasSearched(false);
      setError(searchError instanceof ApiError ? searchError.message : 'Unable to search right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleRelationshipAction = async (person: UserSearchResult) => {
    if (!token || busyUserId !== null) return;
    setBusyUserId(person.userId);
    setError('');
    setNotice('');
    try {
      if (person.relationship === 'NONE') {
        await sendFriendRequest(person.userId, token);
        setResults((items) => items.map((item) => item.userId === person.userId
          ? { ...item, relationship: 'PENDING_OUTGOING' }
          : item));
        setNotice(`Friend request sent to ${person.displayName}.`);
      } else if (person.relationship === 'FRIENDS') {
        const conversation = await openDirectConversation(person.userId, token);
        navigate(`/app/chat/${conversation.conversationId}`);
      } else if (person.relationship === 'PENDING_INCOMING') {
        navigate('/app/friends?tab=incoming');
      } else {
        navigate('/app/friends?tab=outgoing');
      }
    } catch (actionError) {
      setError(actionError instanceof ApiError ? actionError.message : 'Unable to update this connection.');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleMessage = async (person: UserSearchResult) => {
    if (!token || busyUserId !== null) return;
    setBusyUserId(person.userId);
    setError('');
    try {
      const conversation = await openDiscoveryConversation(person.userId, token);
      navigate(`/app/chat/${conversation.conversationId}`);
    } catch (messageError) {
      setError(messageError instanceof ApiError ? messageError.message : 'Unable to open this conversation.');
    } finally { setBusyUserId(null); }
  };

  return (
    <section className="page-content">
      <div className="page-heading"><div><p className="eyebrow">DISCOVER</p><h1>Search people</h1></div></div>
      <p className="page-intro">Look up GeoChat members by username or display name.</p>
      <form className="search-form" onSubmit={(event) => void submit(event)}>
        <label className="visually-hidden" htmlFor="user-search">Username or display name</label>
        <span className="search-glyph" aria-hidden="true">⌕</span>
        <input id="user-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or username" />
        <button className="primary-button" type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
      </form>
      {error ? <div className="inline-error" role="alert">{error}</div> : null}
      {notice ? <p className="inline-notice" role="status">{notice}</p> : null}
      {loading ? <div className="result-state" role="status"><span className="spinner" />Searching GeoChat…</div> : null}
      {!loading && hasSearched && results.length === 0 ? <div className="result-state empty-state">No users found. Try another name.</div> : null}
      {!loading && hasSearched && results.length > 0 ? (
        <div className="results-list" aria-label="Search results">
          {results.map((person) => (
            <article className="person-row" key={person.userId}>
              <span className="person-avatar">{person.displayName.charAt(0).toUpperCase()}</span>
              <span className="person-details"><strong>{person.displayName}</strong><small>@{person.username}</small></span>
              <div className="nearby-actions">
                {person.relationship !== 'FRIENDS' ? <button className="primary-button compact-button" type="button"
                  disabled={busyUserId !== null} onClick={() => void handleMessage(person)}>Message</button> : null}
                {relationshipAction(person.relationship, busyUserId === person.userId, () => void handleRelationshipAction(person), busyUserId !== null)}
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {!loading && !hasSearched && !error ? <div className="result-state search-hint">Search results will appear here.</div> : null}
    </section>
  );
}

function relationshipAction(relationship: UserSearchResult['relationship'], busy: boolean, onPress: () => void, disabled: boolean) {
  const labels = {
    NONE: 'Add friend',
    PENDING_OUTGOING: 'Request sent · manage',
    PENDING_INCOMING: 'Review request',
    FRIENDS: 'Chat',
  } satisfies Record<UserSearchResult['relationship'], string>;
  return (
    <button className={relationship === 'NONE' || relationship === 'FRIENDS' ? 'primary-button compact-button' : 'quiet-light-button compact-button'}
      type="button" onClick={onPress} disabled={disabled}>
      {busy ? 'Working…' : labels[relationship]}
    </button>
  );
}