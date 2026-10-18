import { useLocale, translate as t } from '../../i18n';
import { Link } from 'react-router-dom';
import { ConnectedAccounts } from './ConnectedAccounts';
import { AccountLifecycleSection } from './AccountLifecycleSection';
import { LanguageSelector } from '../../i18n/LanguageSelector';
import { useAuth } from '../../app/providers/AuthContext';
import { ThemePreference, useTheme } from '../../app/providers/ThemeContext';
import { useNotifications } from '../../app/providers/NotificationContext';

export function SettingsPage() {
  useLocale();
  const { logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const { preferences, updatePreferences } = useNotifications();

  return (
    <section className="page-content settings-page">
      <div className="page-heading">
        <div><p className="eyebrow">YOUR ACCOUNT</p><h1>{t('common.settings')}</h1></div>
      </div>

      <section className="settings-section" aria-labelledby="language-settings-heading">
        <div className="section-heading"><div><h2 id="language-settings-heading">{t('language.title')}</h2>
          <p>{t('language.description')}</p></div></div>
        <LanguageSelector />
      </section>

      <section className="settings-section" aria-labelledby="appearance-settings-heading">
        <div className="section-heading">
          <div><h2 id="appearance-settings-heading">{t('settings.appearance')}</h2><p>{t('settings.appearanceHelp')}</p></div>
        </div>
        <fieldset className="theme-selector" aria-describedby="theme-help">
          <legend>{t('settings.theme')}</legend>
          {(['light', 'dark', 'system'] as ThemePreference[]).map((mode) => (
            <label key={mode}>
              <input type="radio" name="theme" value={mode} checked={preference === mode} onChange={() => setPreference(mode)} />
              <span>{t(mode === 'light' ? 'settings.light' : mode === 'dark' ? 'settings.dark' : 'settings.system')}</span>
            </label>
          ))}
        </fieldset>
        <p className="theme-help" id="theme-help">{t('settings.themeHelp')}</p>
      </section>

      <section className="settings-section" aria-labelledby="notification-settings-heading">
        <div className="section-heading"><div><h2 id="notification-settings-heading">{t('settings.alerts')}</h2>
          <p>{t('settings.alertsHelp')}</p></div></div>
        <div className="notification-preferences">
          {([
            ['directAlerts', t('settings.direct')], ['groupAlerts', t('settings.group')],
            ['friendRequestAlerts', t('settings.requests')], ['friendAcceptanceAlerts', t('settings.accepted')],
          ] as const).map(([key, label]) => <label className="settings-row" key={key}>
            <span><strong>{label}</strong></span><input type="checkbox" checked={preferences[key]}
              onChange={(event) => void updatePreferences({ ...preferences, [key]: event.target.checked })} />
          </label>)}
        </div>
      </section>

      <section className="settings-section" aria-labelledby="account-settings-heading">
        <div className="section-heading">
          <div><h2 id="account-settings-heading">{t('settings.account')}</h2><p>{t('settings.accountHelp')}</p></div>
        </div>
        <Link className="settings-row" to="/app/profile">
          <span><strong>{t('common.profile')}</strong><small>{t('settings.profileHelp')}</small></span>
          <b aria-hidden="true">→</b>
        </Link>
      </section>

      <ConnectedAccounts />
      <AccountLifecycleSection />
      <section className="settings-section" aria-labelledby="session-settings-heading">
        <div className="section-heading">
          <div><h2 id="session-settings-heading">{t('settings.session')}</h2><p>{t('settings.sessionHelp')}</p></div>
        </div>
        <div className="settings-row settings-logout-row">
          <span><strong>{t('common.signOut')}</strong><small>{t('settings.signInAgain')}</small></span>
          <button className="quiet-light-button" type="button" onClick={logout}>{t('common.signOut')}</button>
        </div>
      </section>
    </section>
  );
}
