import { AdminFilterPanel } from './AdminFilterPanel';
import { useEffect, useState } from 'react';
import { AuditRow, getAdminAudit } from '../../api/admin';
import { ApiError } from '../../api/client';
import { useAuth } from '../../app/providers/AuthContext';
import { AdminAuditTable } from './AdminAuditTable';
import { translate as t, translateText as text, useLocale } from '../../i18n';

export function AdminAuditPage() {
  useLocale();
  const { token } = useAuth();
  const [filters, setFilters] = useState<Record<string,string>>({ action: '', actor: '', target: '', after: '', before: '' });
  const [applied, setApplied] = useState<Record<string,string>>({});
  const [page, setPage] = useState(0), [rows, setRows] = useState<AuditRow[]>([]), [more, setMore] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController(); setLoading(true); setError(''); setRows([]);
    const query = Object.fromEntries(Object.entries(applied).filter(([,v]) => v));
    for (const key of ['after','before']) if (query[key]) query[key] += 'T00:00:00Z';
    void getAdminAudit(token, { ...query, page: String(page) }, controller.signal).then(result => { if (!controller.signal.aborted) { setRows(result.items); setMore(result.hasMore); } })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof ApiError ? e.message : t('account.failed')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, applied, page, revision]);
  return <section className="page-content"><h1>{t('management.audit')}</h1><AdminFilterPanel onSubmit={() => { setApplied({ ...filters }); setPage(0); }} onClear={() => { setFilters({ action: '', actor: '', target: '', after: '', before: '' }); setApplied({}); setPage(0); }}>
    <label>{t('management.action')}<select value={filters.action} onChange={e => setFilters({ ...filters, action: e.target.value })}><option value="">{t('management.all')}</option>
      {['BLOCK','UNBLOCK','GRANT_ADMIN','REVOKE_ADMIN','GRANT_SUPER_ADMIN','DEACTIVATE','REACTIVATE'].map(action => <option key={action}>{action}</option>)}</select></label>
    {(['actor','target'] as const).map(key => <label key={key}>{t(`management.${key}`)}<input type="number" min={key === 'actor' ? 0 : 1} value={filters[key]} onChange={e => setFilters({ ...filters, [key]: e.target.value })} /></label>)}
    {(['after','before'] as const).map(key => <label key={key}>{t(`management.${key}`)}<input type="date" value={filters[key]} onChange={e => setFilters({ ...filters, [key]: e.target.value })} /></label>)}
    </AdminFilterPanel>
    {loading ? <p role="status">{t('common.wait')}</p> : error ? <p role="alert">{text(error)} <button onClick={() => setRevision(revision + 1)}>{t('management.retry')}</button></p> : <AdminAuditTable rows={rows} />}
    <div className="account-action-buttons"><button disabled={loading || page === 0} onClick={() => setPage(page - 1)}>{t('admin.previous')}</button><span>{page + 1}</span>
      <button disabled={loading || !more || !!error} onClick={() => setPage(page + 1)}>{t('admin.next')}</button></div></section>;
}
