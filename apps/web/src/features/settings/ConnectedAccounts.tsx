import { useLocale, translate as t, translateText as text } from '../../i18n';
import { useEffect, useState } from 'react';
import { useAuth } from '../../app/providers/AuthContext';
import { Connections, googleConfig, googleConnections, startGoogle, unlinkGoogle } from '../../api/google';
import { ApiError } from '../../api/client';

export function ConnectedAccounts() {
  useLocale();
  const { token } = useAuth();
  const [connections, setConnections] = useState<Connections | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!token) return;
    let active = true;
    void Promise.all([googleConfig(), googleConnections(token)]).then(([config, current]) => {
      if (active) { setEnabled(config.enabled); setConnections(current); }
    }).catch(() => { if (active) setNotice(t('google.loadFailed')); });
    return () => { active = false; };
  }, [token]);
  const change = async () => {
    if (!token || !connections) return;
    setBusy(true); setNotice('');
    try {
      if (connections.googleConnected) {
        await unlinkGoogle(token, password); setPassword('');
        setConnections(await googleConnections(token)); setNotice(t('google.disconnected'));
      } else { await startGoogle(token, password); }
    } catch (e) { setNotice(e instanceof ApiError ? e.message : t('google.connectFailed')); }
    finally { setBusy(false); }
  };
  return <section className="settings-section" aria-labelledby="connected-accounts-heading">
    <h2 id="connected-accounts-heading">{t('google.connectedAccounts')}</h2>
    {notice ? <p role="status">{text(notice)}</p> : null}
    {!connections ? (notice ? null : <p role="status">{t('google.loadingAccounts')}</p>) : <>
      <p><strong>Google</strong> — {connections.googleConnected ? t('google.connected') : t('google.notConnected')}</p>
      {connections.email ? <p className="connected-email">{connections.email}</p> : null}
      {!connections.passwordAvailable ? <p>{t('google.onlyMethod')}</p> : (connections.googleConnected || enabled) ? <div className="form-stack connected-account-form">
        <label htmlFor="google-password">{t('google.confirmPassword')}</label>
        <input id="google-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} maxLength={128} />
        <button className="quiet-light-button" type="button" disabled={busy || !password} onClick={() => void change()}>
          {busy ? t('common.wait') : connections.googleConnected ? t('google.disconnect') : t('google.connect')}
        </button>
      </div> : <p>{t('google.disabled')}</p>}
    </>}
  </section>;
}
