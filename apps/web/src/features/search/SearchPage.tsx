import { FormEvent, useState } from 'react';
import { searchUsers } from '../../api/users';
import { ApiError } from '../../api/client';
import { useAuth } from '../../app/providers/AuthContext';
import { UserSearchResult } from '../../types';

export function SearchPage() {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    } catch (searchError) {
      setResults([]);
      setHasSearched(false);
      setError(searchError instanceof ApiError ? searchError.message : 'Unable to search right now.');
    } finally {
      setLoading(false);
    }
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
      {loading ? <div className="result-state" role="status"><span className="spinner" />Searching GeoChat…</div> : null}
      {!loading && hasSearched && results.length === 0 ? <div className="result-state empty-state">No users found. Try another name.</div> : null}
      {!loading && hasSearched && results.length > 0 ? (
        <div className="results-list" aria-label="Search results">
          {results.map((person) => (
            <article className="person-row" key={person.userId}>
              <span className="person-avatar">{person.displayName.charAt(0).toUpperCase()}</span>
              <span className="person-details"><strong>{person.displayName}</strong><small>@{person.username}</small></span>
            </article>
          ))}
        </div>
      ) : null}
      {!loading && !hasSearched && !error ? <div className="result-state search-hint">Search results will appear here.</div> : null}
    </section>
  );
}