import { Link } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthContext';

export function SettingsPage() {
  const { logout } = useAuth();

  return (
    <section className="page-content settings-page">
      <div className="page-heading">
        <div><p className="eyebrow">YOUR ACCOUNT</p><h1>Settings</h1></div>
      </div>

      <section className="settings-section" aria-labelledby="account-settings-heading">
        <div className="section-heading">
          <div><h2 id="account-settings-heading">Account</h2><p>Manage the profile information available to GeoChat.</p></div>
        </div>
        <Link className="settings-row" to="/app/profile">
          <span><strong>Profile</strong><small>Update your public display name</small></span>
          <b aria-hidden="true">→</b>
        </Link>
      </section>

      <section className="settings-section" aria-labelledby="session-settings-heading">
        <div className="section-heading">
          <div><h2 id="session-settings-heading">Session</h2><p>End this session on this device.</p></div>
        </div>
        <div className="settings-row settings-logout-row">
          <span><strong>Sign out</strong><small>Your token and realtime connections will be cleared.</small></span>
          <button className="quiet-light-button" type="button" onClick={logout}>Sign out</button>
        </div>
      </section>
    </section>
  );
}