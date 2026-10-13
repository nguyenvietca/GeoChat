import { useEffect, useState } from 'react';
import { apiImage } from '../../api/client';

export function UserAvatar({ userId, displayName, avatarUpdatedAt, token, className = 'person-avatar' }: {
  userId: number; displayName: string; avatarUpdatedAt?: string | null; token: string | null; className?: string;
}) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!token || !avatarUpdatedAt) { setUrl(''); return; }
    const controller = new AbortController();
    let objectUrl = '';
    void apiImage(`/api/v1/users/${userId}/avatar`, token, controller.signal).then(blob => {
      objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    }).catch(() => setUrl(''));
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [userId, avatarUpdatedAt, token]);
  return <span className={`${className} user-avatar`} aria-hidden="true">{url ? <img src={url} alt="" /> : displayName.charAt(0).toUpperCase() || '?'}</span>;
}
