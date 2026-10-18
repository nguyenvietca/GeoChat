import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayFocus } from '../../hooks/useOverlayFocus';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthContext';
import { AdminUser, listAdminUsers, moderateAccount } from '../../api/accounts';
import { ApiError } from '../../api/client';
import { useLocale, translate as t, translateText as text } from '../../i18n';

export function AdminUsersPage() {
  useLocale();
  const { user, token } = useAuth();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<AdminUser[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [reason, setReason] = useState('');
  const [dialogError, setDialogError] = useState('');
  const dialogRef = useRef<HTMLFormElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeDialog = () => {
    if (busy) return;
    setSelected(null); setReason(''); setDialogError('');
  };
  useOverlayFocus(dialogRef, selected?.id ?? null, closeDialog, true, busy, triggerRef);
  useEffect(() => {
    if (!selected) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [selected]);
  const load = useCallback(async () => {
    if (!token || user?.role !== 'ADMIN') return;
    setLoading(true); setError('');
    try { const result = await listAdminUsers(token, search, page); setItems(result.items); setHasMore(result.hasMore); }
    catch (e) { setError(e instanceof ApiError ? e.message : t('account.failed')); }
    finally { setLoading(false); }
  }, [token, user?.role, search, page]);
  useEffect(() => { void load(); }, [load]);
  if (user?.role !== 'ADMIN') return <Navigate to="/app/home" replace />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !selected || !reason.trim() || busy) return;
    setBusy(true); setDialogError(''); setNotice('');
    try {
      await moderateAccount(token, selected.id, selected.status !== 'LOCKED', reason.trim());
      setSelected(null); setReason(''); setNotice(t('admin.updated')); await load();
    } catch (e) { setDialogError(e instanceof ApiError ? e.message : t('account.failed')); }
    finally { setBusy(false); }
  };
  return <section className="page-content admin-users-page"><h1>{t('admin.title')}</h1><p>{t('admin.help')}</p>
    <form className="account-search" onSubmit={e => { e.preventDefault(); setSearch(query); setPage(0); setNotice(''); }}>
      <label htmlFor="admin-query">{t('admin.search')}</label><input id="admin-query" value={query} maxLength={100} onChange={e => setQuery(e.target.value)} />
      <button className="quiet-light-button" disabled={busy || loading}>{t('common.search')}</button></form>
    {error ? <p className="error-message" role="alert">{text(error)}</p> : null}
    {notice ? <p className="success-message" role="status">{text(notice)}</p> : null}
    {selected ? createPortal(<div className="group-confirm-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) closeDialog(); }}>
      <form ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="moderation-title" aria-describedby="moderation-help"
        aria-busy={busy} tabIndex={-1} className="group-confirm-dialog form-stack account-action-form moderation-dialog" onSubmit={e => void submit(e)}>
      <h2 id="moderation-title">{t(selected.status === 'LOCKED' ? 'admin.unblock' : 'admin.block')} @{selected.displayName}</h2>
      <p id="moderation-help">{t('admin.confirmHelp')}</p>
      <label htmlFor="moderation-reason">{t('admin.reason')}</label>
      <textarea id="moderation-reason" required maxLength={500} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} />
      {dialogError ? <p className="error-message" role="alert">{text(dialogError)}</p> : null}
      <div className="account-action-buttons"><button className="primary-button" disabled={busy || !reason.trim()}>{busy ? t('common.wait') : t('admin.confirm')}</button>
        <button type="button" className="quiet-light-button" disabled={busy} onClick={closeDialog}>{t('common.cancel')}</button></div>
    </form></div>, document.body) : null}
    {loading ? <p role="status">{t('common.wait')}</p> : <ul className="admin-user-list">{items.map(item => <li className="settings-section" key={item.id}>
      <div><strong>{item.displayName}</strong><p>@{item.username}</p><span className="status-chip">{t(item.status === 'LOCKED' ? 'account.blocked' : item.status === 'INACTIVE' ? 'account.inactive' : 'account.active')}</span>
        {item.blockReason ? <p>{t('admin.reason')}: {item.blockReason}</p> : null}</div>
      {item.role !== 'ADMIN' ? <button className="quiet-light-button" disabled={busy || !!selected} onClick={event => { triggerRef.current = event.currentTarget; setSelected(item); setReason(''); setDialogError(''); setError(''); setNotice(''); }}>{t(item.status === 'LOCKED' ? 'admin.unblock' : 'admin.block')}</button> : <span>Admin</span>}
    </li>)}</ul>}
    {!loading && items.length === 0 ? <p>{t('admin.empty')}</p> : null}
    <div className="account-action-buttons"><button className="quiet-light-button" disabled={busy || loading || page === 0} onClick={() => setPage(page - 1)}>{t('admin.previous')}</button>
      <span>{page + 1}</span><button className="quiet-light-button" disabled={busy || loading || !hasMore} onClick={() => setPage(page + 1)}>{t('admin.next')}</button></div>
  </section>;
}
