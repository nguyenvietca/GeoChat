import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { useAuth } from '../../app/providers/AuthContext';
import { AuthFrame } from './AuthFrame';

type LoginLocationState = { from?: string; registered?: boolean };

export function LoginPage() {
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
      setError('Enter your username and password.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login({ username: username.trim(), password });
      navigate(locationState?.from ?? '/app/home', { replace: true });
    } catch (loginError) {
      setError(loginError instanceof ApiError ? loginError.message : 'Unable to sign in right now.');
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
      <h2>Sign in</h2>
      <p className="auth-description">Pick up where your next conversation begins.</p>
      {sessionNotice ? (
        <div className="error-message" role="status">
          <p>{sessionNotice}</p>
          <button className="quiet-light-button compact-button" type="button" onClick={() => void retryRestore()} disabled={retryingSession}>
            {retryingSession ? 'Retrying…' : 'Retry session check'}
          </button>
        </div>
      ) : null}
      {locationState?.registered ? <p className="success-message" role="status">Account created. Sign in to continue.</p> : null}
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <label className="field-label" htmlFor="login-username">Username</label>
        <input id="login-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
        <label className="field-label" htmlFor="login-password">Password</label>
        <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="auth-switch">New to GeoChat? <Link to="/register">Create an account</Link></p>
    </AuthFrame>
  );
}
