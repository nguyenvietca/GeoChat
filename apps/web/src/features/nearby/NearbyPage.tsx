import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getFriends, getIncomingFriendRequests, getOutgoingFriendRequests, sendFriendRequest, acceptFriendRequest, cancelFriendRequest, rejectFriendRequest } from '../../api/friends';
import { openContextualConversation, openDirectConversation } from '../../api/chats';
import { getNearbyUsers, updateCurrentLocation, getDiscoverability, setDiscoverability } from '../../api/location';
import { ApiError } from '../../api/client';
import { useAuth } from '../../app/providers/AuthContext';
import { FriendRelationship, NearbyUser } from '../../types';
import { NearbyMap } from './NearbyMap';
import { approximateDistance, radiusOptions, requestLocation } from './nearbyPresentation';
export function NearbyPage() {
    const { token } = useAuth(); const navigate = useNavigate();
    const [radius, setRadius] = useState(5000), [resultRadius, setResultRadius] = useState(5000);
    const [people, setPeople] = useState<NearbyUser[]>([]); const [relationships, setRelationships] = useState<Record<number, FriendRelationship>>({});
    const radiusRef = useRef(radius); radiusRef.current = radius;
    const incoming = useRef(new Map<number, number>());
    const outgoingRequests = useRef(new Map<number, number>());
    const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(null);
    const [selected, setSelected] = useState<number | null>(null); const [view, setView] = useState<'list' | 'map'>('list');
    const [searched, setSearched] = useState(false), [loading, setLoading] = useState(false), [locating, setLocating] = useState(false);
    const [discoverable, setVisible] = useState<boolean | null>(null), [savingVisibility, setSavingVisibility] = useState(false);
    const [busy, setBusy] = useState<number | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState('');
    const [page, setPage] = useState(0), [hasMore, setHasMore] = useState(false);
    const generation = useRef(0); const mounted = useRef(true); const busyRef = useRef(false);
    useEffect(() => { mounted.current = true; let active = true; if (token) void getDiscoverability(token).then(result => { if (active) setVisible(result.discoverable); }).catch(() => { if (active) setError('Unable to load your discovery setting. Refresh to try again.'); }); return () => { active = false; mounted.current = false; generation.current++; }; }, [token]);
    async function findNearby(refreshLocation: boolean, nextPage = 0) {
        if (!token) {
            return;
        }
        const request = ++generation.current;
        setLoading(true); setError('');
        setNotice('');
        try {
            if (refreshLocation) {
                setLocating(true); const point = await requestLocation();
                if (!mounted.current || request !== generation.current) {
                    return;
                }
                await updateCurrentLocation({ latitude: point.coords.latitude, longitude: point.coords.longitude }, token);
                if (!mounted.current || request !== generation.current) {
                    return;
                }
                setCenter({ latitude: point.coords.latitude, longitude: point.coords.longitude });
                setLocating(false);
            }
            const response = nextPage ? await getNearbyUsers(radiusRef.current, token, nextPage) : await getNearbyUsers(radiusRef.current, token);
            const [friends, requests, outgoing] = await Promise.all([getFriends(token), getIncomingFriendRequests(token), getOutgoingFriendRequests(token)]);
            if (!mounted.current || request !== generation.current) return;
            incoming.current = new Map(requests.items.map(item => [item.user.userId, item.requestId]));
            outgoingRequests.current = new Map(outgoing.items.map(item => [item.user.userId, item.requestId]));
            const friendIds = new Set(friends.items.map(item => item.userId)), sent = new Set(outgoing.items.map(item => item.user.userId));
            const states = Object.fromEntries(response.items.map(person => [person.userId, friendIds.has(person.userId) ? 'FRIENDS' : incoming.current.has(person.userId) ? 'PENDING_INCOMING' : sent.has(person.userId) ? 'PENDING_OUTGOING' : 'NONE'])) as Record<number, FriendRelationship>;
            setRelationships(current => nextPage ? { ...current, ...states } : states);
            setPeople(current => nextPage ? [...new Map([...current, ...response.items].map(person => [person.userId, person])).values()] : response.items);
            if (!nextPage) setSelected(current => response.items.some(person => person.userId === current) ? current : null);
            setResultRadius(response.radiusMeters); setPage(nextPage); setHasMore(response.hasMore ?? false); setSearched(true);
        } catch (failure) { if (mounted.current && request === generation.current) { setError(failure instanceof Error ? failure.message : 'Unable to find nearby users right now.'); if (!nextPage) { setPeople([]); setSearched(false); } } }
        finally { if (mounted.current && request === generation.current) { setLoading(false); setLocating(false); } }
    }
    useEffect(() => { if (center) void findNearby(false); }, [radius]);
    async function visibility() { if (!token || discoverable === null || savingVisibility) return; setSavingVisibility(true); setError(''); try { const result = await setDiscoverability(!discoverable, token); if (mounted.current) { setVisible(result.discoverable); setNotice(result.discoverable ? 'You can now appear in Nearby when your location is fresh.' : 'You are hidden from Nearby. You can still search for others.'); } } catch { if (mounted.current) setError('Unable to save discovery setting. Please try again.'); } finally { if (mounted.current) setSavingVisibility(false); } }
    async function action(person: NearbyUser, chat = false) {
        if (!token || busyRef.current) {
            return;
        }
        busyRef.current = true;
        setBusy(person.userId);
        setError('');
        setNotice('');
        try {
            const state = relationships[person.userId] ?? 'NONE';
            if (chat) {
                const conversation = state === 'FRIENDS' ? await openDirectConversation(person.userId, token) : await openContextualConversation(person.userId, resultRadius, token);
                if (mounted.current) navigate(`/app/chat/${conversation.conversationId}`);
            }
            else if (state === 'NONE') {
                await sendFriendRequest(person.userId, token);
                if (mounted.current) {
                    setRelationships(current => ({ ...current, [person.userId]: 'PENDING_OUTGOING' }));
                    setNotice(`Friend request sent to ${person.displayName}.`);
                }
            }
            else if (state === 'PENDING_INCOMING') { const id = incoming.current.get(person.userId); if (!id) throw new Error(); await acceptFriendRequest(id, token); if (mounted.current) { setRelationships(current => ({ ...current, [person.userId]: 'FRIENDS' })); setNotice(`You and ${person.displayName} are now friends.`); } }
            else if (state === 'PENDING_OUTGOING') { const id = outgoingRequests.current.get(person.userId); if (!id) throw new Error(); await cancelFriendRequest(id, token); if (mounted.current) { outgoingRequests.current.delete(person.userId); setRelationships(current => ({ ...current, [person.userId]: 'NONE' })); setNotice('Friend request cancelled.'); } }
        } catch (failure) {
            if (mounted.current) {
                setError(failure instanceof ApiError ? failure.message : 'Unable to update this connection. Refresh nearby to check its current state.');
            }
        }
        finally {
            busyRef.current = false;
            if (mounted.current) {
                setBusy(null);
            }
        }
    }
    async function reject(person: NearbyUser) {
        if (!token || busyRef.current) return;
        const id = incoming.current.get(person.userId); if (!id) return;
        busyRef.current = true; setBusy(person.userId); setError('');
        try { await rejectFriendRequest(id, token); if (mounted.current) { incoming.current.delete(person.userId); setRelationships(current => ({ ...current, [person.userId]: 'NONE' })); setNotice('Friend request rejected.'); } }
        catch (failure) { if (mounted.current) setError(failure instanceof ApiError ? failure.message : 'Unable to reject this request.'); }
        finally { busyRef.current = false; if (mounted.current) setBusy(null); }
    }
    function select(id: number) {
        setSelected(id);
        document.querySelector<HTMLElement>(`[data-nearby-card="${id}"]`)?.scrollIntoView?.({
            block: 'nearest', behavior: 'auto'
        });
    }
    const selectedPerson = people.find(person => person.userId === selected);
    return <section className="page-content nearby-page">
        <div className="page-heading">
            <div>
                <p className="eyebrow">AROUND YOU</p>
                <h1>Nearby people</h1>
            </div>
            <label className="radius-control" htmlFor="nearby-radius">Within
                <select id="nearby-radius" value={radius} onChange={event => setRadius(Number(event.target.value))}>{radiusOptions.map(value => <option key={value} value={value}>{value / 1000} km</option>)}</select></label></div>
        <p className="page-intro">Discover your local circle. Distances and map areas are approximate.</p>
        <div className="discovery-setting">
            <label>
                <input type="checkbox" checked={discoverable ?? false} disabled={discoverable === null || savingVisibility} onChange={() => void visibility()} />Allow others to discover me nearby</label>
            <small>{discoverable ? 'Visible with a location updated in the last 24 hours.' : 'Hidden from Nearby. Searching does not turn visibility on.'}</small>
        </div>
        <div className="nearby-intro">
            <div>
                <strong>Find your local circle</strong>
                <p>Use a one-time location update. GPS permission and discovery visibility are separate.</p>
            </div>
            <button className="primary-button" type="button" disabled={locating} onClick={() => void findNearby(!center)}>{locating ? 'Checking your location...' : searched ? 'Refresh nearby' : 'Use my location'}</button>
            {center ? <button className="quiet-light-button" type="button" disabled={locating} onClick={() => void findNearby(true)}>Update location</button> : null}
        </div>
        {error ?
            <div className="inline-error" role="alert">{error}
                <button type="button" onClick={() => void findNearby(!center)}>Try again</button>
            </div> : null}
        {notice ?
            <p className="inline-notice" role="status">{notice}</p> : null}
        {loading ?
            <p role="status">{locating ? 'Checking your location...' : 'Updating nearby people...'}</p> : null}
        {searched && people.length === 0 ?
            <div className="result-state">No nearby users found in this radius. Try a wider radius; only discoverable members with a fresh location appear.</div> : null}
        {center ?
            <><div className="nearby-view-toggle" aria-label="Nearby view">
                <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>List view</button>
                <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>Map view</button>
            </div>
                {selectedPerson ?
                    <p className="inline-notice" role="status">Selected: {selectedPerson.displayName}
                        <Link to={`/app/profile/${selectedPerson.userId}`}>View profile</Link>
                    </p> : null}
                <div className={`nearby-workspace view-${view}`}>
                    <div className="nearby-list" aria-label="Nearby users" aria-busy={loading}>
                        {people.map(person => <article key={person.userId} data-nearby-card={person.userId} className={`nearby-card${selected === person.userId ? ' selected' : ''}`}>
                            <button type="button" className="nearby-card-select" aria-pressed={selected === person.userId} onClick={() => select(person.userId)}>
                                <span className="person-avatar">{person.displayName.charAt(0).toUpperCase()}</span>
                                <span><strong>{person.displayName}</strong><small>{approximateDistance(person.distanceMeters)}</small></span>
                            </button>
                            <p className="nearby-relationship">
                                {relationships[person.userId] === 'FRIENDS' ? 'Friends' : relationships[person.userId] === 'PENDING_INCOMING' ? 'Request received' : relationships[person.userId] === 'PENDING_OUTGOING' ? 'Request sent' : 'Not friends'}
                            </p>
                            <div className="nearby-card-actions"><Link to={`/app/profile/${person.userId}`}>View profile</Link>
                                <button type="button" disabled={busy !== null || loading} onClick={() => void action(person, true)}>
                                    {relationships[person.userId] === 'FRIENDS' ? 'Chat' : 'Message'}</button>
                                {relationships[person.userId] === 'PENDING_OUTGOING' ?
                                    <button type="button" disabled={busy !== null || loading} onClick={() => void action(person)}>{busy === person.userId ? 'Working...' : 'Cancel request'}</button> : relationships[person.userId] !== 'FRIENDS' ?
                                        <button type="button" disabled={busy !== null || loading} onClick={() => void action(person)}>
                                            {busy === person.userId ? 'Working...' : relationships[person.userId] === 'PENDING_INCOMING' ? 'Accept request' : 'Add friend'}
                                        </button> : null}
                                {relationships[person.userId] === 'PENDING_INCOMING' ? <button type="button" disabled={busy !== null || loading} onClick={() => void reject(person)}>Reject</button> : null}
                            </div>
                        </article>)}
                        {hasMore ? <button type="button" disabled={loading} onClick={() => void findNearby(false, page + 1)}>Load more people</button> : null}
                    </div>
                    <NearbyMap center={center} people={people} selected={selected} onSelect={select} visible={view === 'map'} />
                </div></> : null}
    </section>;
}
