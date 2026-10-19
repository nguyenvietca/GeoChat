import { AuditRow } from '../../api/admin';
import { translate as t, useLocale } from '../../i18n';

export function AdminAuditTable({ rows }: { rows: AuditRow[] }) {
  useLocale();
  return <div className="admin-table-scroll"><table className="admin-table"><caption className="sr-only">{t('management.audit')}</caption>
    <thead><tr>{(['time','actor','action','target','reason'] as const).map(key => <th scope="col" key={key}>{t(`management.${key}`)}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={row.id}><td>{new Date(row.createdAt).toLocaleString()}</td><td>{row.actor ?? '—'} <small>#{row.actorId}</small></td>
      <td>{row.action}<br /><small>{row.previousStatus && row.newStatus ? row.previousStatus + ' → ' + row.newStatus : ''}{row.previousRole && row.newRole ? ' · ' + row.previousRole + ' → ' + row.newRole : ''}</small></td>
      <td>{row.target ?? '—'} <small>#{row.targetId}</small></td><td>{row.reason || '—'}</td></tr>)}</tbody>
  </table>{rows.length === 0 ? <p>{t('admin.empty')}</p> : null}</div>;
}
