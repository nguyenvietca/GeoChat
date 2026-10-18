import { useState } from 'react';
import { useAuth } from '../../app/providers/AuthContext';
import { reactivateAccount } from '../../api/accounts';
import { ApiError } from '../../api/client';
import { useLocale, translate as t, translateText as text } from '../../i18n';

export function ReactivateAccountPage() {
  useLocale();
  const { token, user, logout, acceptGoogleSession } = useAuth();
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const activate = async () => {
    if (!token || busy || !confirmed) return;
    setBusy(true); setError('');
    try {
      const result = await reactivateAccount(token);
      await acceptGoogleSession(result.token);
    } catch (e) { setError(e instanceof ApiError ? e.message : t('account.failed')); }
    finally { setBusy(false); }
  };
  return <main className="state-page"><section className="settings-section account-action-form" aria-labelledby="reactivate-heading">
    <h1 id="reactivate-heading">{t('account.reactivate')}</h1>
    <p>{user?.displayName}</p><p>{t('account.activationRequired')}</p>
    <label className="account-confirm">
      <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy} />{t('account.activateConfirm')}</label>
    {error ? <p className="error-message" role="alert">{text(error)}</p> : null}
    <div className="account-action-buttons">
      <button className="primary-button" disabled={busy || !confirmed} onClick={() => void activate()}>{busy ? t('common.wait') : t('account.reactivate')}</button>
      <button className="quiet-light-button" disabled={busy} onClick={logout}>{t('common.signOut')}</button></div>
  </section></main>;
}
