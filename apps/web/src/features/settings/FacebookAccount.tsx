import { useLocale, translate as t, translateText as text } from '../../i18n';
import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { FacebookConnections, facebookConfig, facebookConnections, reauthenticateProvider, startFacebook, unlinkFacebook } from '../../api/facebook';

export function FacebookAccount({ token, googleAvailable, onAvailable }: {
  token: string; googleAvailable: boolean; onAvailable: (available: boolean) => void;
}) {
  useLocale();
  const [current, setCurrent] = useState<FacebookConnections | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    void Promise.all([facebookConfig(), facebookConnections(token)]).then(([config, connections]) => {
      if (active) { setEnabled(config.enabled); setCurrent(connections); onAvailable(config.enabled && connections.facebookConnected); }
    }).catch(() => { if (active) setNotice(t('facebook.loadFailed')); });
    return () => { active = false; };
  }, [token, onAvailable]);
  const change = async () => {
    if (!current) return;
    setBusy(true); setNotice('');
    try {
      if (!current.passwordAvailable) {
        await reauthenticateProvider('google', current.facebookConnected ? 'unlink' : 'link', token);
      } else if (current.facebookConnected) {
        await unlinkFacebook(token, password); setPassword('');
        setCurrent(await facebookConnections(token)); onAvailable(false);
        setNotice(t('facebook.disconnected'));
      } else { await startFacebook(token, password); }
    } catch (e) { setNotice(e instanceof ApiError ? e.message : t('facebook.updateFailed')); }
    finally { setBusy(false); }
  };
  const allowed = current && (current.passwordAvailable || googleAvailable);
  return <div className="facebook-account">
    <p><strong>Facebook</strong> — {current ? current.facebookConnected ? t('google.connected') : t('google.notConnected') : t('google.loadingAccounts')}</p>
    {notice ? <p role="status">{text(notice)}</p> : null}
    {current?.email ? <p className="connected-email">{current.email}</p> : null}
    {current && !allowed ? <p>{t('oauth.keepMethod')}</p> : null}
    {allowed && (current.facebookConnected || enabled) ? <div className="form-stack connected-account-form">
      {current.passwordAvailable ? <><label htmlFor="facebook-password">{t('facebook.confirmPassword')}</label>
        <input id="facebook-password" type="password" autoComplete="current-password" maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></> : <p>{t('facebook.confirmGoogle')}</p>}
      <button className="quiet-light-button" type="button" disabled={busy || (current.passwordAvailable && !password)} onClick={() => void change()}>
        {busy ? t('common.wait') : current.facebookConnected ? t('facebook.disconnect') : t('facebook.connect')}
      </button>
    </div> : current && !enabled ? <p>{t('facebook.disabled')}</p> : null}
  </div>;
}
