import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthContext';
import { LanguageSelector } from '../../i18n/LanguageSelector';
import { translate as t, useLocale } from '../../i18n';

export function AdminLayout() {
  useLocale();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  if (isLoading) return <main className="state-page">{t('common.wait')}</main>;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user?.status !== 'ACTIVE' || !['ADMIN', 'SUPER_ADMIN'].includes(user.role ?? '')) return <Navigate to="/app/home" replace />;
  return <div className="admin-frame">
    <a className="skip-link" href="#admin-content">{t('admin.skip')}</a>
    <header className="admin-header"><Link className="brand-lockup" to="/admin">GeoChat Admin</Link>
      <span>{user.displayName} · {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}</span>
      <LanguageSelector /><Link to="/app/home">{t('admin.back')}</Link>
      <button className="quiet-light-button" onClick={logout}>{t('common.signOut')}</button></header>
    <nav className="admin-nav" aria-label={t('admin.navigation')}><NavLink to="/admin" end>{t('admin.overview')}</NavLink>
      <NavLink to="/admin/users">{t('admin.title')}</NavLink></nav>
    <main id="admin-content" tabIndex={-1}><Outlet /></main>
  </div>;
}
