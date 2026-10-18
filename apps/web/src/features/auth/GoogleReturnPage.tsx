import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { completeGoogle } from '../../api/google';
import { useAuth } from '../../app/providers/AuthContext';
import { ApiError } from '../../api/client';

export function GoogleReturnPage() {
  const { token, isLoading, acceptGoogleSession } = useAuth();
  const navigate = useNavigate();
  const started = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (isLoading || started.current) return;
    started.current = true;
    const failure = new URLSearchParams(window.location.search).get('error');
    window.history.replaceState(window.history.state, '', '/oauth/complete');
    if (failure) { setError(failure === 'cancelled' ? 'Google sign-in was cancelled.' : 'Google sign-in failed or expired. Please try again.'); return; }
    void completeGoogle(token ?? undefined).then(async result => {
      if (!result.linked) {
        if (!result.token) throw new Error('Missing session');
        await acceptGoogleSession(result.token);
      }
      navigate(result.linked ? '/app/settings' : '/app/home', { replace: true });
    }).catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Google sign-in could not be completed. Please try again.'));
  }, [isLoading, token, acceptGoogleSession, navigate]);
  return <main className="state-page"><h1>Google sign-in</h1>
    {error ? <><p role="alert">{error}</p><Link to={token ? '/app/settings' : '/login'}>Return and try again</Link></> : <p role="status">Completing sign-in…</p>}
  </main>;
}
