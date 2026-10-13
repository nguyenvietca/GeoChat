import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { searchUsers } from '../../api/users';
import { acceptFriendRequest, cancelFriendRequest, rejectFriendRequest, sendFriendRequest } from '../../api/friends';
import { openDiscoveryConversation, openDirectConversation } from '../../api/chats';
import { ApiError } from '../../api/client';
import { useAuth } from '../../app/providers/AuthContext';
import { UserSearchResult } from '../../types';

export function SearchPage({ embedded = false }: { embedded?: boolean }) {
  const { token } = useAuth(); const navigate = useNavigate();
  const [query, setQuery] = useState(''), [results, setResults] = useState<UserSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false), [loading, setLoading] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [busyUserId, setBusyUserId] = useState<number | null>(null), [page, setPage] = useState(0), [hasMore, setHasMore] = useState(false);
  const generation = useRef(0);

  async function runSearch(cleanQuery: string, nextPage = 0) {
    if (!token || cleanQuery.length < 2) return;
    const request = ++generation.current; setLoading(true); setError('');
    if (nextPage === 0) setResults([]);
    try {
      const response = nextPage === 0 ? await searchUsers(cleanQuery, token) : await searchUsers(cleanQuery, token, nextPage);
      if (request !== generation.current) return;
      setResults((current) => nextPage === 0 ? response.items : [...new Map([...current, ...response.items].map((person) => [person.userId, person])).values()]);
      setPage(nextPage); setHasMore(response.hasMore ?? false); setHasSearched(true); setNotice('');
    } catch (searchError) {
      if (request !== generation.current) return;
      if (nextPage === 0) setResults([]);
      setError(searchError instanceof ApiError ? searchError.message : 'Unable to search right now.'); setHasSearched(nextPage > 0);
    } finally { if (request === generation.current) setLoading(false); }
  }

  useEffect(() => {
    const cleanQuery = query.trim(); generation.current += 1; setNotice(''); setError(''); setResults([]); setHasMore(false); setHasSearched(false); setLoading(false);
    if (cleanQuery.length < 2) return;
    const timer = window.setTimeout(() => void runSearch(cleanQuery), 300);
    return () => window.clearTimeout(timer);
  }, [query, token]);

  const replaceRelationship = (userId: number, relationship: UserSearchResult['relationship'], requestId: number | null = null) =>
    setResults((items) => items.map((item) => item.userId === userId ? { ...item, relationship, requestId } : item));

  async function relationshipAction(person: UserSearchResult) {
    if (!token || busyUserId !== null) return;
    setBusyUserId(person.userId); setError(''); setNotice('');
    try {
      if (person.relationship === 'NONE') { const request = await sendFriendRequest(person.userId, token); replaceRelationship(person.userId, 'PENDING_OUTGOING', request.requestId); setNotice(`Friend request sent to ${person.displayName}.`); }
      else if (person.relationship === 'PENDING_OUTGOING' && person.requestId) { await cancelFriendRequest(person.requestId, token); replaceRelationship(person.userId, 'NONE'); setNotice('Friend request cancelled.'); }
      else if (person.relationship === 'PENDING_INCOMING' && person.requestId) { await acceptFriendRequest(person.requestId, token); replaceRelationship(person.userId, 'FRIENDS'); setNotice(`You and ${person.displayName} are now friends.`); }
      else if (person.relationship === 'FRIENDS') { const conversation = await openDirectConversation(person.userId, token); navigate(`/app/chat/${conversation.conversationId}`); }
    } catch (actionError) { setError(actionError instanceof ApiError ? actionError.message : 'Unable to update this connection. Search again to refresh its state.'); }
    finally { setBusyUserId(null); }
  }

  async function reject(person: UserSearchResult) {
    if (!token || !person.requestId || busyUserId !== null) return;
    setBusyUserId(person.userId); setError('');
    try { await rejectFriendRequest(person.requestId, token); replaceRelationship(person.userId, 'NONE'); setNotice('Friend request rejected.'); }
    catch (actionError) { setError(actionError instanceof ApiError ? actionError.message : 'Unable to reject this request.'); }
    finally { setBusyUserId(null); }
  }

  async function message(person: UserSearchResult) {
    if (!token || busyUserId !== null) return;
    setBusyUserId(person.userId); setError('');
    try { const conversation = person.relationship === 'FRIENDS' ? await openDirectConversation(person.userId, token) : await openDiscoveryConversation(person.userId, token); navigate(`/app/chat/${conversation.conversationId}`); }
    catch (messageError) { setError(messageError instanceof ApiError ? messageError.message : 'Unable to open this conversation.'); }
    finally { setBusyUserId(null); }
  }

  const content = <>
    <form className="search-form" onSubmit={(event) => { event.preventDefault(); const clean = query.trim(); if (clean.length < 2) { setError('Enter at least 2 characters to search.'); setResults([]); setHasSearched(false); return; } void runSearch(clean); }}>
      <label className="visually-hidden" htmlFor="user-search">Username or display name</label><span className="search-glyph" aria-hidden="true">⌕</span>
      <input id="user-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or username" autoComplete="off" />
      <button className="primary-button" type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
    </form>
    {error ? <div className="inline-error" role="alert">{error}<button type="button" onClick={() => void runSearch(query.trim(), page)}>Try again</button></div> : null}
    {notice ? <p className="inline-notice" role="status">{notice}</p> : null}
    {loading && results.length === 0 ? <div className="result-state" role="status"><span className="spinner" />Searching GeoChat…</div> : null}
    {!loading && hasSearched && results.length === 0 ? <div className="result-state empty-state">No matching users. Try another name.</div> : null}
    {results.length > 0 ? <div className="results-list" aria-label="Search results">
      {results.map((person) => <article className="person-row discovery-row" key={person.userId}>
        <span className="person-avatar">{person.displayName.charAt(0).toUpperCase()}</span>
        <span className="person-details"><strong>{person.displayName}</strong><small>@{person.username}</small><em>{relationshipLabel(person.relationship)}</em></span>
        <div className="request-actions"><Link className="quiet-light-button compact-button" to={`/app/profile/${person.userId}`}>Profile</Link>
          <button className="quiet-light-button compact-button" type="button" disabled={busyUserId !== null} onClick={() => void message(person)}>Message</button>
          <button className="primary-button compact-button" type="button" disabled={busyUserId !== null} onClick={() => void relationshipAction(person)}>{busyUserId === person.userId ? 'Working…' : actionLabel(person.relationship)}</button>
          {person.relationship === 'PENDING_INCOMING' ? <button className="quiet-light-button compact-button" type="button" disabled={busyUserId !== null} onClick={() => void reject(person)}>Reject</button> : null}
        </div>
      </article>)}
      {hasMore ? <button className="quiet-light-button" type="button" disabled={loading} onClick={() => void runSearch(query.trim(), page + 1)}>{loading ? 'Loading…' : 'Load more'}</button> : null}
    </div> : null}
    {!loading && !hasSearched && !error ? <div className="result-state search-hint">Enter at least 2 characters. Results appear automatically.</div> : null}
  </>;
  if (embedded) return <section className="friends-discovery" aria-labelledby="find-people-heading"><h2 id="find-people-heading">Find people</h2><p>Search by public display name or username.</p>{content}</section>;
  return <section className="page-content"><div className="page-heading"><div><p className="eyebrow">DISCOVER</p><h1>Search people</h1></div></div><p className="page-intro">Look up GeoChat members by username or display name.</p>{content}</section>;
}

function actionLabel(state: UserSearchResult['relationship']) { return state === 'NONE' ? 'Add friend' : state === 'PENDING_OUTGOING' ? 'Cancel request' : state === 'PENDING_INCOMING' ? 'Accept' : 'Chat'; }
function relationshipLabel(state: UserSearchResult['relationship']) { return state === 'NONE' ? 'Not friends' : state === 'PENDING_OUTGOING' ? 'Request sent' : state === 'PENDING_INCOMING' ? 'Request received' : 'Friends'; }
