import { useLocale, translate as t, translateText as text } from '../../i18n';
import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { useAuth } from '../../app/providers/AuthContext';
import { AuthFrame } from './AuthFrame';
import { GoogleButton } from './GoogleButton';

type LoginLocationState = { from?: string; registered?: boolean; deactivated?: boolean };

export function LoginPage() {
  useLocale();
  const { login, retrySessionRestore, sessionNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LoginLocationState | null;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [retryingSession, setRetryingSession] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError(t('auth.enterCredentials'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login({ username: username.trim(), password });
      navigate(locationState?.from ?? '/app/home', { replace: true });
    } catch (loginError) {
      setError(loginError instanceof ApiError ? loginError.message : t('auth.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const retryRestore = async () => {
    setRetryingSession(true);
    try {
      await retrySessionRestore();
    } finally {
      setRetryingSession(false);
    }
  };

  return (
    <AuthFrame mode="login">
      <h2>{t('auth.signIn')}</h2>
      <GoogleButton />
      <p className="auth-description">Pick up where your next conversation begins.</p>
      {sessionNotice ? (
        <div className="error-message" role="status">
          <p>{text(sessionNotice)}</p>
          <button className="quiet-light-button compact-button" type="button" onClick={() => void retryRestore()} disabled={retryingSession}>
            {retryingSession ? t('auth.retrying') : t('auth.retrySession')}
          </button>
        </div>
      ) : null}
      {locationState?.registered ? <p className="success-message" role="status">{t('auth.registered')}</p> : null}
      {locationState?.deactivated ? <p className="success-message" role="status">{t('account.deactivated')}</p> : null}
      {error ? <p className="error-message" role="alert">{text(error)}</p> : null}
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <label className="field-label" htmlFor="login-username">{t('auth.username')}</label>
        <input id="login-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
        <label className="field-label" htmlFor="login-password">{t('auth.password')}</label>
        <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? t('auth.signingIn') : t('auth.signIn')}</button>
      </form>
      <p className="auth-switch">New to GeoChat? <Link to="/register">Create an account</Link></p>
    </AuthFrame>
  );
}
