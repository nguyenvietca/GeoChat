import { AdminFilterPanel } from '../admin/AdminFilterPanel';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayFocus } from '../../hooks/useOverlayFocus';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { openAdminConversation } from '../../api/admin';
import { useAuth } from '../../app/providers/AuthContext';
import { AdminUser, listAdminUsers, moderateAccount } from '../../api/accounts';
import { ApiError } from '../../api/client';
import { useLocale, translate as t, translateText as text } from '../../i18n';

export function AdminUsersPage() {
  useLocale();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [provider, setProvider] = useState('');
  const [after, setAfter] = useState('');
  const [before, setBefore] = useState('');
  const request = useRef<AbortController | null>(null);
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
    if (!token || !['ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '')) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setLoading(true); setError('');
    try { const result = await listAdminUsers(token, search, page, { status, provider, after: after ? after + 'T00:00:00Z' : '', before: before ? before + 'T00:00:00Z' : '' }, controller.signal); if (!controller.signal.aborted) { setItems(result.items); setHasMore(result.hasMore); } }
    catch (e) { if (!controller.signal.aborted) { setItems([]); setError(e instanceof ApiError ? e.message : t('account.failed')); } }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [token, user?.role, search, page, status, provider, after, before]);
  useEffect(() => { void load(); return () => request.current?.abort(); }, [load]);
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '')) return <Navigate to="/app/home" replace />;
  const message = async (id: number) => {
    if (!token || busy) return;
    setBusy(true); setError('');
    try { const chat = await openAdminConversation(token, id); navigate(`/app/chat/${chat.conversationId}`); }
    catch (e) { setError(e instanceof ApiError ? e.message : t('account.failed')); }
    finally { setBusy(false); }
  };
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
    <AdminFilterPanel onSubmit={() => { setSearch(query); setPage(0); setNotice(''); }} onClear={() => { setQuery(''); setSearch(''); setStatus(''); setProvider(''); setAfter(''); setBefore(''); setPage(0); setNotice(''); }}>
      <label className="admin-filter-search" htmlFor="admin-query">{t('admin.search')}<input id="admin-query" type="search" value={query} maxLength={100} onChange={e => setQuery(e.target.value)} /></label>

      <label>{t('management.status')}<select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="">{t('management.all')}</option>{['ACTIVE','INACTIVE','LOCKED'].map(s => <option key={s} value={s}>{t(s === 'LOCKED' ? 'account.blocked' : s === 'INACTIVE' ? 'account.inactive' : 'account.active')}</option>)}</select></label>
      <label>{t('management.provider')}<select value={provider} onChange={e => { setProvider(e.target.value); setPage(0); }}><option value="">{t('management.all')}</option>{['PASSWORD','GOOGLE','FACEBOOK'].map(p => <option key={p} value={p}>{p === 'PASSWORD' ? t('auth.password') : p === 'GOOGLE' ? 'Google' : 'Facebook'}</option>)}</select></label>
      <label>{t('management.after')}<input type="date" value={after} onChange={e => { setAfter(e.target.value); setPage(0); }} /></label>
      <label>{t('management.before')}<input type="date" value={before} onChange={e => { setBefore(e.target.value); setPage(0); }} /></label>
    </AdminFilterPanel>
    {error ? <p className="error-message" role="alert">{text(error)} <button onClick={() => void load()}>{t('management.retry')}</button></p> : null}
    {notice ? <p className="success-message" role="status">{text(notice)}</p> : null}
    {selected ? createPortal(<div className="group-confirm-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) closeDialog(); }}>
      <form ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="moderation-title" aria-describedby="moderation-help"
        aria-busy={busy} tabIndex={-1} className="group-confirm-dialog form-stack account-action-form moderation-dialog" onSubmit={e => void submit(e)}>
      <h2 id="moderation-title">{t(selected.status === 'LOCKED' ? 'admin.unblock' : 'admin.block')} @{selected.username}</h2>
      <p id="moderation-help">{t('admin.confirmHelp')}</p>
      <label htmlFor="moderation-reason">{t('admin.reason')}</label>
      <textarea id="moderation-reason" required maxLength={500} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} />
      {dialogError ? <p className="error-message" role="alert">{text(dialogError)}</p> : null}
      <div className="account-action-buttons"><button className="primary-button" disabled={busy || !reason.trim()}>{busy ? t('common.wait') : t('admin.confirm')}</button>
        <button type="button" className="quiet-light-button" disabled={busy} onClick={closeDialog}>{t('common.cancel')}</button></div>
    </form></div>, document.body) : null}
    {loading ? <p role="status">{t('common.wait')}</p> : <div className="admin-table-scroll"><table className="admin-table"><caption className="sr-only">{t('admin.title')}</caption><thead><tr><th scope="col">{t('management.user')}</th><th scope="col">{t('management.email')}</th><th scope="col">{t('management.status')}</th><th scope="col">{t('management.registered')}</th><th scope="col">{t('management.actions')}</th></tr></thead><tbody>{items.map(item => <tr key={item.id}>
      <td><Link to={"/admin/users/" + item.id}><strong>{item.displayName}</strong></Link><p>@{item.username}</p></td><td>{item.email || '—'}</td><td><span className="status-chip">{t(item.status === 'LOCKED' ? 'account.blocked' : item.status === 'INACTIVE' ? 'account.inactive' : 'account.active')}</span>
        {item.blockReason ? <p>{t('admin.reason')}: {item.blockReason}</p> : null}</td>
      <td>{item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}</td><td><div className="account-action-buttons">
      {user?.role === 'SUPER_ADMIN' && item.id !== user.id && item.status === 'ACTIVE' ? <button className="quiet-light-button" disabled={busy || !!selected} onClick={() => void message(item.id)}>{t('admin.message')}</button> : null}
      {!['ADMIN', 'SUPER_ADMIN'].includes(item.role) ? <button className="quiet-light-button" disabled={busy || !!selected} onClick={event => { triggerRef.current = event.currentTarget; setSelected(item); setReason(''); setDialogError(''); setError(''); setNotice(''); }}>{t(item.status === 'LOCKED' ? 'admin.unblock' : 'admin.block')}</button> : <span>{item.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}</span>}
      </div></td>
    </tr>)}</tbody></table></div>}
    {!loading && !error && items.length === 0 ? <p>{t('admin.empty')}</p> : null}
    <div className="account-action-buttons"><button className="quiet-light-button" disabled={busy || loading || page === 0} onClick={() => setPage(page - 1)}>{t('admin.previous')}</button>
      <span>{page + 1}</span><button className="quiet-light-button" disabled={busy || loading || !hasMore || !!error} onClick={() => setPage(page + 1)}>{t('admin.next')}</button></div>
  </section>;
}
