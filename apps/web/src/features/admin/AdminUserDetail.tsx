import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AdminDetail, getAdminUser } from '../../api/admin';
import { ApiError } from '../../api/client';
import { useAuth } from '../../app/providers/AuthContext';
import { AdminDecision } from './AdminDecision';
import { AdminAuditTable } from './AdminAuditTable';
import { translate as t, translateText as text, useLocale } from '../../i18n';

export function AdminUserDetail() {
  useLocale();
  const { token } = useAuth(), { userId = '' } = useParams();
  const [data, setData] = useState<AdminDetail | null>(null), [error, setError] = useState(''), [revision, setRevision] = useState(0), [notice, setNotice] = useState('');
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController(); setData(null); setError('');
    void getAdminUser(token, userId, controller.signal).then(next => { if (!controller.signal.aborted) setData(next); })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof ApiError ? e.message : t('account.failed')); });
    return () => controller.abort();
  }, [token, userId, revision]);
  return <section className="page-content"><Link to="/admin/users">{t('admin.title')}</Link><h1>{t('management.details')}</h1>
    {error ? <p role="alert">{text(error)} <button onClick={() => setRevision(revision + 1)}>{t('management.retry')}</button></p> : !data ? <p role="status">{t('common.wait')}</p> : <>
      <h2>{data.user.displayName} · @{data.user.username}</h2><dl className="admin-detail-fields">
        <dt>ID</dt><dd>{data.user.id}</dd><dt>{t('management.email')}</dt><dd>{data.user.email || '—'}</dd><dt>{t('management.status')}</dt><dd>{data.user.status}</dd>
        <dt>{t('management.registered')}</dt><dd>{data.user.createdAt ? new Date(data.user.createdAt).toLocaleString() : '—'}</dd>
        <dt>{t('management.provider')}</dt><dd>{data.user.providers?.join(', ') || '—'}</dd><dt>{t('management.reason')}</dt><dd>{data.user.blockReason || '—'}</dd>
      </dl>{token ? <AdminDecision token={token} user={data.user} onDone={async () => { setNotice(t('admin.updated')); setRevision(value => value + 1); }} /> : null}
      <h2>{t('management.history')}</h2><AdminAuditTable rows={data.history} />
    </>}{notice ? <p role="status">{notice}</p> : null}</section>;
}
