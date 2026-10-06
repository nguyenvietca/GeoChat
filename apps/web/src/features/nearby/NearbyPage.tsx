import { useState } from 'react';
import { getNearbyUsers, updateCurrentLocation } from '../../api/location';
import { ApiError } from '../../api/client';
import { useAuth } from '../../app/providers/AuthContext';
import { NearbyUser } from '../../types';

const radiusOptions = [1000, 5000, 10000, 25000];

function getLocation() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser does not support location access.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (locationError) => {
      if (locationError.code === locationError.PERMISSION_DENIED) {
        reject(new Error('Location permission is required to find nearby users. You can allow it in your browser settings.'));
      } else if (locationError.code === locationError.TIMEOUT) {
        reject(new Error('Location request timed out. Try again when you have a clearer signal.'));
      } else {
        reject(new Error('Your current location is unavailable. Check your device location settings and try again.'));
      }
    }, { enableHighAccuracy: false, maximumAge: 30000, timeout: 12000 });
  });
}

function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m away`;
  return `${(distanceMeters / 1000).toFixed(1)} km away`;
}

export function NearbyPage() {
  const { token } = useAuth();
  const [radius, setRadius] = useState(5000);
  const [people, setPeople] = useState<NearbyUser[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const findNearby = async () => {
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      return;
    }
    setLoading(true);
    setError('');
    setHasSearched(false);
    try {
      const position = await getLocation();
      await updateCurrentLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }, token);
      const response = await getNearbyUsers(radius, token);
      setPeople(response.items);
      setHasSearched(true);
    } catch (nearbyError) {
      setPeople([]);
      setError(nearbyError instanceof ApiError || nearbyError instanceof Error
        ? nearbyError.message
        : 'Unable to find nearby users right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page-content">
      <div className="page-heading">
        <div><p className="eyebrow">AROUND YOU</p><h1>Nearby people</h1></div>
        <label className="radius-control" htmlFor="nearby-radius">Within
          <select id="nearby-radius" value={radius} onChange={(event) => setRadius(Number(event.target.value))} disabled={loading}>
            {radiusOptions.map((option) => <option value={option} key={option}>{option < 1000 ? `${option} m` : `${option / 1000} km`}</option>)}
          </select>
        </label>
      </div>
      <p className="page-intro">Your exact location is used for this search and is never shown here.</p>
      <div className="nearby-intro">
        <span className="nearby-mark" aria-hidden="true">◎</span>
        <div><strong>Find your local circle</strong><p>Share a one-time location update to see members within your radius.</p></div>
        <button className="primary-button" type="button" onClick={() => void findNearby()} disabled={loading}>
          {loading ? 'Finding people…' : hasSearched ? 'Refresh nearby' : 'Use my location'}
        </button>
      </div>
      {error ? <div className="inline-error" role="alert">{error}<button type="button" onClick={() => void findNearby()}>Try again</button></div> : null}
      {loading ? <div className="result-state" role="status"><span className="spinner" />Checking your location…</div> : null}
      {!loading && hasSearched && people.length === 0 ? <div className="result-state empty-state">No nearby users found in this radius.</div> : null}
      {!loading && hasSearched && people.length > 0 ? (
        <div className="results-list" aria-label="Nearby users">
          {people.map((person) => (
            <article className="person-row" key={person.userId}>
              <span className="person-avatar nearby-avatar">{person.displayName.charAt(0).toUpperCase()}</span>
              <span className="person-details"><strong>{person.displayName}</strong><small>GeoChat member</small></span>
              <span className="distance-label">{formatDistance(person.distanceMeters)}</span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
