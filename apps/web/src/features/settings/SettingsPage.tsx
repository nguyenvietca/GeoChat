import { Link } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthContext';
import { ThemePreference, useTheme } from '../../app/providers/ThemeContext';

export function SettingsPage() {
  const { logout } = useAuth();
  const { preference, setPreference } = useTheme();

  return (
    <section className="page-content settings-page">
      <div className="page-heading">
        <div><p className="eyebrow">YOUR ACCOUNT</p><h1>Settings</h1></div>
      </div>

      <section className="settings-section" aria-labelledby="appearance-settings-heading">
        <div className="section-heading">
          <div><h2 id="appearance-settings-heading">Appearance</h2><p>Choose what feels comfortable to read.</p></div>
        </div>
        <fieldset className="theme-selector" aria-describedby="theme-help">
          <legend>Theme</legend>
          {(['light', 'dark', 'system'] as ThemePreference[]).map((mode) => (
            <label key={mode}>
              <input type="radio" name="theme" value={mode} checked={preference === mode} onChange={() => setPreference(mode)} />
              <span>{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
            </label>
          ))}
        </fieldset>
        <p className="theme-help" id="theme-help">System follows your device. Changes apply immediately and are saved in this browser.</p>
      </section>

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
          <span><strong>Sign out</strong><small>You can sign in again whenever you need.</small></span>
          <button className="quiet-light-button" type="button" onClick={logout}>Sign out</button>
        </div>
      </section>
    </section>
  );
}
