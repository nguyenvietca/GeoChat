import { useEffect, useState } from 'react';
import { useAuth } from '../../app/providers/AuthContext';
import { Connections, googleConfig, googleConnections, startGoogle, unlinkGoogle } from '../../api/google';
import { ApiError } from '../../api/client';

export function ConnectedAccounts() {
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
    }).catch(() => { if (active) setNotice('Connected accounts could not be loaded. Try again after refreshing.'); });
    return () => { active = false; };
  }, [token]);
  const change = async () => {
    if (!token || !connections) return;
    setBusy(true); setNotice('');
    try {
      if (connections.googleConnected) {
        await unlinkGoogle(token, password); setPassword('');
        setConnections(await googleConnections(token)); setNotice('Google disconnected. Your password still works.');
      } else { await startGoogle(token, password); }
    } catch (e) { setNotice(e instanceof ApiError ? e.message : 'Google could not be connected. Please try again.'); }
    finally { setBusy(false); }
  };
  return <section className="settings-section" aria-labelledby="connected-accounts-heading">
    <h2 id="connected-accounts-heading">Connected Accounts</h2>
    {notice ? <p role="status">{notice}</p> : null}
    {!connections ? (notice ? null : <p role="status">Loading connected accounts…</p>) : <>
      <p><strong>Google</strong> — {connections.googleConnected ? 'Connected' : 'Not connected'}</p>
      {connections.email ? <p className="connected-email">{connections.email}</p> : null}
      {!connections.passwordAvailable ? <p>Google is your only sign-in method and cannot be disconnected.</p> : (connections.googleConnected || enabled) ? <div className="form-stack connected-account-form">
        <label htmlFor="google-password">Confirm your current password</label>
        <input id="google-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} maxLength={128} />
        <button className="quiet-light-button" type="button" disabled={busy || !password} onClick={() => void change()}>
          {busy ? 'Please wait…' : connections.googleConnected ? 'Disconnect Google' : 'Connect Google'}
        </button>
      </div> : <p>Google sign-in is currently unavailable.</p>}
    </>}
  </section>;
}
