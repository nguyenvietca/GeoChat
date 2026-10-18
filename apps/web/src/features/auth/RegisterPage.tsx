import { useLocale, translate as t, translateText as text } from '../../i18n';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { useAuth } from '../../app/providers/AuthContext';
import { AuthFrame } from './AuthFrame';
import { GoogleButton } from './GoogleButton';
import { RegistrationVerification, RegistrationProof } from './RegistrationVerification';

export function RegisterPage() {
  useLocale();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [proof, setProof] = useState<RegistrationProof>({ pending: true, enabled: false, token: '' });
  const [verificationReset, setVerificationReset] = useState(0);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || proof.pending || (proof.enabled && !proof.token)) return;
    const cleanUsername = username.trim();
    const cleanDisplayName = displayName.trim();
    if (cleanUsername.length < 3 || cleanUsername.length > 50) {
      setError(t('auth.usernameLength'));
      return;
    }
    if (cleanDisplayName.length < 2 || cleanDisplayName.length > 100) {
      setError(t('auth.nameLength'));
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setError(t('auth.passwordLength'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await register({ username: cleanUsername, displayName: cleanDisplayName, password,
        ...(proof.enabled ? { botToken: proof.token } : {}) });
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (registerError) {
      if (proof.enabled) setVerificationReset(value => value + 1);
      setError(registerError instanceof ApiError ? registerError.message : t('auth.registerFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFrame mode="register">
      <h2>{t('auth.createAccount')}</h2>
      <GoogleButton />
      <p className="auth-description">Set up your GeoChat account to get started.</p>
      {error ? <p className="error-message" role="alert">{text(error)}</p> : null}
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <label className="field-label" htmlFor="register-display-name">{t('auth.displayName')}</label>
        <input id="register-display-name" autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        <label className="field-label" htmlFor="register-username">{t('auth.username')}</label>
        <input id="register-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
        <label className="field-label" htmlFor="register-password">{t('auth.password')}</label>
        <input id="register-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <label className="field-label" htmlFor="register-confirm-password">{t('auth.confirmPassword')}</label>
        <input id="register-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
        <RegistrationVerification onChange={setProof} resetKey={verificationReset} />
        <button className="primary-button" type="submit" disabled={submitting || proof.pending || (proof.enabled && !proof.token)}>{submitting ? t('auth.creatingAccount') : t('auth.createAccount')}</button>
      </form>
      <p className="auth-switch">Already have an account? <Link to="/login">{t('auth.signIn')}</Link></p>
    </AuthFrame>
  );
}
