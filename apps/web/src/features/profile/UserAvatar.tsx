import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiImage } from '../../api/client';
import { useOverlayFocus } from '../../hooks/useOverlayFocus';
import { translate as t, useLocale } from '../../i18n';

export function UserAvatar({ userId, displayName, avatarUpdatedAt, token, className = 'person-avatar' }: {
  userId: number; displayName: string; avatarUpdatedAt?: string | null; token: string | null; className?: string;
}) {
  useLocale();
  const [url, setUrl] = useState('');
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const viewer = useRef<HTMLDivElement>(null);
  useOverlayFocus(viewer, open && Boolean(url), () => setOpen(false), true, false, trigger);
  useEffect(() => {
    if (!open || !url) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open, url]);
  useEffect(() => {
    setUrl(''); setOpen(false);
    if (!token || !avatarUpdatedAt) return;
    const controller = new AbortController();
    let objectUrl = '';
    let active = true;
    void apiImage(`/api/v1/users/${userId}/avatar`, token, controller.signal).then(blob => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    }).catch(() => { if (active) setUrl(''); });
    return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [userId, avatarUpdatedAt, token]);
  if (!url) return <span className={`${className} user-avatar`} aria-hidden="true">{displayName.charAt(0).toUpperCase() || '?'}</span>;
  return <>
    <button ref={trigger} type="button" className={`${className} user-avatar avatar-preview-trigger`}
      aria-label={t('profile.viewAvatar', { name: displayName })} aria-haspopup="dialog"
      onClick={event => { event.stopPropagation(); setOpen(true); }}>
      <img src={url} alt="" onError={() => { setOpen(false); setUrl(''); }} />
    </button>
    {open ? createPortal(<div className="image-viewer-backdrop" onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div ref={viewer} className="image-viewer avatar-viewer" role="dialog" aria-modal="true"
        aria-label={t('profile.viewAvatar', { name: displayName })} tabIndex={-1}>
        <button type="button" onClick={() => setOpen(false)}>{t('common.close')}</button>
        <img src={url} alt={t('profile.avatarOf', { name: displayName })} onError={() => { setOpen(false); setUrl(''); }} />
      </div>
    </div>, document.body) : null}
  </>;
}
