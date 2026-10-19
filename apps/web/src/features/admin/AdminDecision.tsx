import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayFocus } from '../../hooks/useOverlayFocus';
import { AdminUser, moderateAccount } from '../../api/accounts';
import { ApiError } from '../../api/client';
import { translate as t, translateText as text, useLocale } from '../../i18n';

export function AdminDecision({ token, user, onDone }: { token: string; user: AdminUser; onDone: () => Promise<void> }) {
  useLocale();
  const [open, setOpen] = useState(false), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const form = useRef<HTMLFormElement>(null), trigger = useRef<HTMLButtonElement>(null), submitting = useRef(false);
  const close = () => { if (!submitting.current) { setOpen(false); setReason(''); setError(''); } };
  useOverlayFocus(form, open ? user.id : null, close, true, busy, trigger);
  if (user.role !== 'USER') return <span>{user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}</span>;
  const label = t(user.status === 'LOCKED' ? 'admin.unblock' : 'admin.block');
  return <><button ref={trigger} className="quiet-light-button" disabled={busy} onClick={() => setOpen(true)}>{label}</button>
    {open ? createPortal(<div className="group-confirm-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
      <form ref={form} role="dialog" aria-modal="true" aria-labelledby={'moderation-' + user.id} aria-describedby={'effect-' + user.id} aria-busy={busy} tabIndex={-1}
        className="group-confirm-dialog form-stack account-action-form moderation-dialog" onSubmit={e => {
          e.preventDefault(); if (!reason.trim() || submitting.current) return;
          submitting.current = true; setBusy(true); setError('');
          void moderateAccount(token, user.id, user.status !== 'LOCKED', reason.trim()).then(async () => {
            setOpen(false); setReason(''); await onDone();
          }).catch(e => setError(e instanceof ApiError ? e.message : t('account.failed')))
            .finally(() => { submitting.current = false; setBusy(false); });
        }}>
        <h2 id={'moderation-' + user.id}>{label} @{user.username}</h2><p id={'effect-' + user.id}>{t('admin.confirmHelp')}</p>
        <label htmlFor={'reason-' + user.id}>{t('admin.reason')}</label><textarea id={'reason-' + user.id} required maxLength={500} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} />
        {error ? <p role="alert" className="error-message">{text(error)}</p> : null}
        <div className="account-action-buttons"><button className="primary-button" disabled={busy || !reason.trim()}>{busy ? t('common.wait') : t('admin.confirm')}</button>
          <button type="button" className="quiet-light-button" disabled={busy} onClick={close}>{t('common.cancel')}</button></div>
      </form></div>, document.body) : null}</>;
}
