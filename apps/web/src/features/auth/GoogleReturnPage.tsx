import { useLocale, translate as t, translateText as text } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { completeGoogle } from '../../api/google';
import { useAuth } from '../../app/providers/AuthContext';
import { ApiError } from '../../api/client';

export function GoogleReturnPage() {
  useLocale();
  const { token, isLoading, acceptGoogleSession } = useAuth();
  const navigate = useNavigate();
  const started = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (isLoading || started.current) return;
    started.current = true;
    const failure = new URLSearchParams(window.location.search).get('error');
    window.history.replaceState(window.history.state, '', '/oauth/complete');
    if (failure) { setError(failure === 'cancelled' ? t('google.cancelled') : t('google.expired')); return; }
    void completeGoogle(token ?? undefined).then(async result => {
      if (!result.linked) {
        if (!result.token) throw new Error('Missing session');
        await acceptGoogleSession(result.token);
      }
      navigate(result.linked ? '/app/settings' : '/app/home', { replace: true });
    }).catch((e: unknown) => setError(e instanceof ApiError ? e.message : t('google.completeFailed')));
  }, [isLoading, token, acceptGoogleSession, navigate]);
  return <main className="state-page"><h1>{t('google.signIn')}</h1>
    {error ? <><p role="alert">{text(error)}</p><Link to={token ? '/app/settings' : '/login'}>{t('google.retry')}</Link></> : <p role="status">{t('google.completing')}</p>}
  </main>;
}
