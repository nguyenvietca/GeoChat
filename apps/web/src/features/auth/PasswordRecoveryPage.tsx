import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { passwordRecoveryConfig, requestPasswordReset, resetPassword } from '../../api/password';
import { ApiError } from '../../api/client';
import { AuthFrame } from './AuthFrame';
import { useAuth } from '../../app/providers/AuthContext';
import { translate as t, translateText as text, useLocale } from '../../i18n';

export function PasswordRecoveryPage({ mode }: { mode: 'forgot' | 'reset' }) {
  useLocale();
  const { logout } = useAuth();
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '');
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (mode === 'reset') window.history.replaceState(window.history.state, '', window.location.pathname);
    let active = true;
    void passwordRecoveryConfig().then(config => { if (active) setEnabled(config.enabled); })
      .catch(() => { if (active) { setEnabled(false); setError(t('password.unavailable')); } });
    return () => { active = false; };
  }, [mode]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy || !enabled || done) return;
    if (mode === 'reset' && password !== confirmation) { setError(t('password.mismatch')); return; }
    if (mode === 'reset' && new TextEncoder().encode(password).length > 72) { setError(t('password.length')); return; }
    setBusy(true); setError('');
    try {
      if (mode === 'forgot') await requestPasswordReset(email.trim());
      else { await resetPassword(token, password); logout(); }
      setDone(true); setPassword(''); setConfirmation('');
    } catch (e) { setError(e instanceof ApiError ? e.message : t('account.failed')); }
    finally { setBusy(false); }
  };
  const validToken = /^[A-Za-z0-9_-]{43}$/.test(token);
  return <AuthFrame mode="login"><h2>{t(mode === 'forgot' ? 'password.forgot' : 'password.reset')}</h2>
    <p>{t(mode === 'forgot' ? 'password.forgotHelp' : 'password.resetHelp')}</p>
    {error ? <p role="alert" className="error-message">{text(error)}</p> : null}
    {done ? <p role="status" className="success-message">{t(mode === 'forgot' ? 'password.sent' : 'password.done')}</p>
      : enabled === null ? <p role="status">{t('common.wait')}</p> : !enabled ? <p role="status">{t('password.unavailable')}</p>
        : mode === 'reset' && !validToken ? <p role="alert">{t('password.invalid')}</p> : <form className="form-stack" onSubmit={e => void submit(e)}>
          {mode === 'forgot' ? <><label htmlFor="recovery-email">{t('profile.email')}</label><input id="recovery-email" type="email" required maxLength={320} autoComplete="email" disabled={busy} value={email} onChange={e => setEmail(e.target.value)} /></>
            : <><label htmlFor="reset-password">{t('password.new')}</label><input id="reset-password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" disabled={busy} value={password} onChange={e => setPassword(e.target.value)} />
              <label htmlFor="reset-confirm">{t('password.confirm')}</label><input id="reset-confirm" type="password" required minLength={8} maxLength={72} autoComplete="new-password" disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></>}
          <button className="primary-button" disabled={busy}>{busy ? t('common.wait') : t(mode === 'forgot' ? 'password.send' : 'password.reset')}</button></form>}
    {mode === 'reset' ? <p><Link to="/forgot-password">{t('password.newLink')}</Link></p> : null}
    <p><Link to="/login">{t('password.back')}</Link></p></AuthFrame>;
}
