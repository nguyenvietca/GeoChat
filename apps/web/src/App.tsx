import { ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppProviders } from './app/providers/AppProviders';
import { useAuth } from './app/providers/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { FriendsPage } from './features/friends/FriendsPage';
import { NearbyPage } from './features/nearby/NearbyPage';
import { SearchPage } from './features/search/SearchPage';
import { MessagesPage } from './features/chat/MessagesPage';
import { NotificationsPage } from './features/notifications/NotificationsPage';
import { useNotifications } from './app/providers/NotificationContext';
import { ProfilePage } from './features/profile/ProfilePage';
import { SettingsPage } from './features/settings/SettingsPage';

function LoadingScreen() {
  return <main className="state-page"><span className="spinner" /><p>Restoring your GeoChat session…</p></main>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  return isAuthenticated ? <Navigate to="/app/home" replace /> : children;
}

function ProtectedArea() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <AppShell />;
}

function AppShell() {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <Link className="brand-lockup" to="/app/home" aria-label="GeoChat home">
          <span className="brand-mark">G</span>
          <span>GeoChat</span>
        </Link>
        <p className="nav-caption">DISCOVER</p>
        <nav className="side-nav" aria-label="Main navigation">
          <NavLink to="/app/home" className="nav-link">
            <span className="nav-icon" aria-hidden="true">⌂</span> Home
          </NavLink>
          <NavLink to="/app/search" className="nav-link">
            <span className="nav-icon" aria-hidden="true">⌕</span> Search
          </NavLink>
          <NavLink to="/app/nearby" className="nav-link">
            <span className="nav-icon" aria-hidden="true">◎</span> Nearby
          </NavLink>
          <NavLink to="/app/friends" className="nav-link">
            <span className="nav-icon" aria-hidden="true">♧</span> Friends
          </NavLink>
          <NavLink to="/app/chat" className="nav-link">
            <span className="nav-icon" aria-hidden="true">▤</span> Messages
          </NavLink>
          <NavLink to="/app/notifications" className="nav-link notifications-nav-link">
            <span className="nav-icon" aria-hidden="true">♧</span> Notifications
            {unreadCount > 0 ? <span className="notification-count" aria-label={`${unreadCount} unread notifications`}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span> : null}
          </NavLink>
        </nav>
        <p className="nav-caption account-nav-caption">ACCOUNT</p>
        <nav className="side-nav account-side-nav" aria-label="Account navigation">
          <NavLink to="/app/profile" className="nav-link account-nav-link">
            <span className="nav-icon" aria-hidden="true">◉</span> Profile
          </NavLink>
          <NavLink to="/app/settings" className="nav-link account-nav-link">
            <span className="nav-icon" aria-hidden="true">⚙</span> Settings
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="signed-in-user">
            <span className="avatar-initial">{user?.displayName?.charAt(0).toUpperCase() ?? '?'}</span>
            <span className="user-meta"><strong>{user?.displayName}</strong><small>@{user?.username}</small></span>
          </div>
          <button className="quiet-button logout-button" type="button" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="mobile-brand"><span className="brand-mark">G</span> GeoChat</span>
          <span className="topbar-user">Signed in as <strong>{user?.username}</strong></span>
          <nav className="mobile-account-nav" aria-label="Account navigation">
            <NavLink to="/app/profile" aria-label="Profile" title="Profile">◉</NavLink>
            <NavLink to="/app/settings" aria-label="Settings" title="Settings">⚙</NavLink>
          </nav>
        </header>
        <main className="content-area" id="main-content" tabIndex={-1}><Outlet /></main>
      </div>
    </div>
  );
}

function HomePage() {
  const { user } = useAuth();
  return (
    <section className="page-content">
      <div className="page-heading">
        <div><p className="eyebrow">YOUR SPACE</p><h1>Welcome, {user?.displayName}</h1></div>
        <span className="status-chip"><span /> Account active</span>
      </div>
      <p className="page-intro">Find people to connect with, nearby or across GeoChat.</p>
      <div className="home-actions">
        <Link to="/app/search" className="action-panel search-panel">
          <span className="panel-symbol">⌕</span><span><strong>Search people</strong><small>Find someone by username or display name</small></span><b>→</b>
        </Link>
        <Link to="/app/nearby" className="action-panel nearby-panel">
          <span className="panel-symbol">◎</span><span><strong>Explore nearby</strong><small>See GeoChat members around you</small></span><b>→</b>
        </Link>
        <Link to="/app/friends" className="action-panel">
          <span className="panel-symbol friends-symbol">♧</span><span><strong>Your friends</strong><small>Manage your circle and requests</small></span><b>→</b>
        </Link>
        <Link to="/app/chat" className="action-panel">
          <span className="panel-symbol messages-symbol">▤</span><span><strong>Messages</strong><small>Continue a direct conversation</small></span><b>→</b>
        </Link>
      </div>
      <section className="account-summary" aria-label="Public profile details">
        <div><span className="summary-label">DISPLAY NAME</span><strong>{user?.displayName}</strong></div>
        <div><span className="summary-label">USERNAME</span><strong>@{user?.username}</strong></div>
      </section>
    </section>
  );
}

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/app/home" replace />} />
          <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
          <Route path="/app" element={<ProtectedArea />}>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<HomePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="nearby" element={<NearbyPage />} />
            <Route path="friends" element={<FriendsPage />} />
            <Route path="chat" element={<MessagesPage />} />
            <Route path="chat/:conversationId" element={<MessagesPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProviders>
  );
}
