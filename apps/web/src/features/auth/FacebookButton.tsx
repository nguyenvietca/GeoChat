import { useLocale, translate as t, translateText as text } from '../../i18n';
import { useEffect, useState } from 'react';
import { facebookConfig, startFacebook } from '../../api/facebook';

export function FacebookButton() {
  useLocale();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void facebookConfig().then(c => { if (active) setEnabled(c.enabled); }).catch(() => {});
    return () => { active = false; };
  }, []);
  if (!enabled) return null;
  const start = async () => {
    setBusy(true); setError('');
    try { await startFacebook(); }
    catch { setError(t('facebook.unavailable')); setBusy(false); }
  };
  return <div className="google-sign-in">
    <button type="button" className="google-button facebook-button" disabled={busy} onClick={() => void start()}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.095 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.027 1.792-4.7 4.533-4.7 1.312 0 2.686.235 2.686.235v2.972H15.83c-1.49 0-1.955.93-1.955 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.095 24 18.1 24 12.073Z"/></svg>
      {busy ? t('facebook.redirecting') : t('facebook.continue')}
    </button>
    {error ? <p role="alert" className="error-message">{error}</p> : null}
  </div>;
}
