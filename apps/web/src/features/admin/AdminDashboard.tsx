import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminOverview, getAdminOverview } from '../../api/admin';
import { ApiError } from '../../api/client';
import { useAuth } from '../../app/providers/AuthContext';
import { translate as t, translateText as text, useLocale } from '../../i18n';

export function AdminDashboard() {
  const { language } = useLocale();
  const { token } = useAuth();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const next = await getAdminOverview(token, controller.signal);
        if (!controller.signal.aborted) { setData(next); setError(''); }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof ApiError ? e.message : t('account.failed')); }
    };
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 15000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [token, refresh]);
  return <section className="page-content"><div className="page-heading"><h1>{t('admin.overview')}</h1>
    <button className="quiet-light-button" onClick={() => setRefresh(refresh + 1)}>{t('admin.refresh')}</button></div>
    <p>{t('admin.onlineHelp')}</p>{error ? <p className="error-message" role="alert">{text(error)}</p> : null}
    {!data ? <p role="status">{t('common.wait')}</p> : <><dl className="admin-stat-grid">
      {(['total', 'active', 'inactive', 'blocked', 'online'] as const).map(key => <div key={key} className="settings-section"><dt>{t(`admin.stats.${key}`)}</dt><dd>{data[key].toLocaleString(language)}</dd></div>)}
    {data.newUsers7Days !== undefined ? <div className="settings-section"><dt>{t('management.new7')}</dt><dd>{data.newUsers7Days}</dd></div> : null}</dl><p>{t('admin.measured')}: {new Date(data.measuredAt).toLocaleString(language)}</p></>}
    <Link className="primary-button" to="/admin/users">{t('admin.title')}</Link>
  </section>;
}
