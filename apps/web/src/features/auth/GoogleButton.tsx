import { useLocale, translate as t, translateText as text } from '../../i18n';
import { useEffect, useState } from 'react';
import { googleConfig, startGoogle } from '../../api/google';

export function GoogleButton() {
  useLocale();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; void googleConfig().then(c => { if (active) setEnabled(c.enabled); }).catch(() => {}); return () => { active = false; }; }, []);
  if (!enabled) return null;
  const start = async () => {
    setBusy(true); setError('');
    try { await startGoogle(); } catch { setError(t('google.unavailable')); setBusy(false); }
  };
  return <div className="google-sign-in">
    <button type="button" className="google-button" disabled={busy} onClick={() => void start()}>
      <img src="/google-g.svg" width="20" height="20" alt="" />{busy ? t('google.connecting') : t('google.continue')}
    </button>
    {error ? <p role="alert" className="error-message">{text(error)}</p> : null}
  </div>;
}
