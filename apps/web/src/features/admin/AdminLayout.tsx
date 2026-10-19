import { useEffect, useState } from 'react';
import { getCurrentUser } from '../../api/auth';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthContext';
import { LanguageSelector } from '../../i18n/LanguageSelector';
import { translate as t, useLocale } from '../../i18n';

export function AdminLayout() {
  useLocale();
  const { user, token, isLoading, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [verified, setVerified] = useState('');
  const [permissionError, setPermissionError] = useState(false);
  const [revision, setRevision] = useState(0);
  const key = (token ?? '') + location.pathname + revision;
  useEffect(() => {
    let active = true; setPermissionError(false);
    if (token && user?.status === 'ACTIVE' && ['ADMIN','SUPER_ADMIN'].includes(user.role ?? '')) {
      const verify = () => { void getCurrentUser(token).then(current => {
        if (!active) return;
        if (current.status === 'ACTIVE' && ['ADMIN','SUPER_ADMIN'].includes(current.role ?? '')) { setVerified(key); setPermissionError(false); }
        else setPermissionError(true);
      }).catch(() => { if (active) setPermissionError(true); }); };
      verify();
      const timer = window.setInterval(verify, 30000); window.addEventListener('focus', verify);
      return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', verify); };
    }
    return () => { active = false; };
  }, [key, token, user?.role, user?.status]);
  if (isLoading) return <main className="state-page">{t('common.wait')}</main>;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user?.status !== 'ACTIVE' || !['ADMIN', 'SUPER_ADMIN'].includes(user.role ?? '')) return <Navigate to="/app/home" replace />;
  if (permissionError) return <main className="state-page"><p role="alert">{t('management.permission')}</p><button onClick={() => setRevision(revision + 1)}>{t('management.retry')}</button><Link to="/app/home">{t('admin.back')}</Link></main>;
  if (verified !== key) return <main className="state-page" role="status">{t('common.wait')}</main>;
  return <div className="admin-frame">
    <a className="skip-link" href="#admin-content">{t('admin.skip')}</a>
    <header className="admin-header"><Link className="brand-lockup" to="/admin">GeoChat Admin</Link>
      <span>{user.displayName} · {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}</span>
      <LanguageSelector /><Link to="/app/settings">{t('settings.appearance')}</Link><Link to="/app/home">{t('admin.back')}</Link>
      <button className="quiet-light-button" onClick={logout}>{t('common.signOut')}</button></header>
    <nav className="admin-nav" aria-label={t('admin.navigation')}><NavLink to="/admin" end>{t('admin.overview')}</NavLink>
      <NavLink to="/admin/users">{t('admin.title')}</NavLink><NavLink to="/admin/audit-logs">{t('management.audit')}</NavLink></nav>
    <main id="admin-content" tabIndex={-1}><Outlet /></main>
  </div>;
}
