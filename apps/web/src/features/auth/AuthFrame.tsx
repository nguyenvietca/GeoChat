import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function AuthFrame({ children, mode }: { children: ReactNode; mode: 'login' | 'register' }) {
  return (
    <main className="auth-page">
      <section className="auth-aside">
        <Link className="brand-lockup" to="/login"><span className="brand-mark">G</span><span>GeoChat</span></Link>
        <div className="auth-aside-copy">
          <p className="eyebrow">A LITTLE CLOSER</p>
          <h1>Good conversations start nearby.</h1>
          <p>Find people by name or explore who is around you.</p>
        </div>
        <div className="orbit-art" aria-hidden="true"><span /><span /><span /><i>G</i></div>
        <small className="auth-footnote">Your place to find your people.</small>
      </section>
      <section className="auth-main">
        <div className="auth-card">
          <div className="auth-mobile-brand"><span className="brand-mark">G</span> GeoChat</div>
          <p className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'CREATE YOUR ACCOUNT'}</p>
          {children}
        </div>
      </section>
    </main>
  );
}