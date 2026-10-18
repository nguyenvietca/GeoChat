import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthContext';
import { deactivateAccount } from '../../api/accounts';
import { googleConfig, googleConnections, startGoogleAccountAction, type Connections } from '../../api/google';
import { ApiError } from '../../api/client';
import { useLocale, translate as t, translateText as text } from '../../i18n';

export function AccountLifecycleSection() {
  useLocale();
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [proof, setProof] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connections, setConnections] = useState<Connections | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  useEffect(() => {
    if (!token || !open) return;
    let active = true;
    void Promise.all([googleConnections(token), googleConfig()]).then(([c, config]) => {
      if (active) { setConnections(c); setGoogleEnabled(config.enabled); }
    }).catch(() => { if (active) setError(t('google.loadFailed')); });
    return () => { active = false; };
  }, [token, open]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !confirmed || busy || !connections) return;
    setBusy(true); setError('');
    try {
      if (connections.passwordAvailable) {
        await deactivateAccount(token, proof);
        logout(); navigate('/login', { replace: true, state: { deactivated: true } });
      } else { await startGoogleAccountAction('deactivate', token); }
    } catch (e) { setError(e instanceof ApiError ? e.message : t('account.failed')); }
    finally { setBusy(false); }
  };
  return <section className="settings-section account-lifecycle" aria-labelledby="lifecycle-heading">
    <h2 id="lifecycle-heading">{t('account.title')}</h2>
    {user?.role === 'ADMIN' ? <><p>{t('account.adminTransfer')}</p><Link className="quiet-light-button" to="/app/admin/users">{t('admin.title')}</Link></> : <>
      <p>{t('account.description')}</p>
      {!open ? <button className="quiet-light-button" onClick={() => setOpen(true)}>{t('account.deactivate')}</button> : <form className="form-stack account-action-form" onSubmit={e => void submit(e)}>
        <p>{t('account.confirmHelp')}</p>
        {connections?.passwordAvailable ? <><label htmlFor="deactivate-password">{t('google.confirmPassword')}</label>
          <input id="deactivate-password" type="password" required maxLength={128} autoComplete="current-password" value={proof} onChange={e => setProof(e.target.value)} /></> : null}
        {connections && !connections.passwordAvailable ? <p>{t(googleEnabled && connections.googleConnected ? 'account.googleProof' : 'google.disabled')}</p> : null}
        <label className="account-confirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />{t('account.confirm')}</label>
        {error ? <p className="error-message" role="alert">{text(error)}</p> : null}
        <div className="account-action-buttons"><button className="primary-button" disabled={busy || !confirmed || !connections || (connections.passwordAvailable ? !proof : !googleEnabled || !connections.googleConnected)}>
          {busy ? t('common.wait') : t('account.deactivate')}</button>
          <button className="quiet-light-button" type="button" disabled={busy} onClick={() => { setOpen(false); setProof(''); setConfirmed(false); setError(''); }}>{t('common.cancel')}</button></div>
      </form>}
    </>}
  </section>;
}
