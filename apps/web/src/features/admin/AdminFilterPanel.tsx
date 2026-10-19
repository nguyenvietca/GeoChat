import { ReactNode } from 'react';
import { translate as t } from '../../i18n';

export function AdminFilterPanel({ children, onSubmit, onClear }: {
  children: ReactNode; onSubmit: () => void; onClear: () => void;
}) {
  return <form className="admin-filter-panel" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
    <div className="admin-filter-heading"><strong>{t('management.filters')}</strong><span>{t('management.filterHelp')}</span></div>
    <div className="admin-filter-grid">{children}</div>
    <div className="admin-filter-footer"><p>{t('management.utcHelp')}</p><div className="admin-filter-actions">
      <button type="button" className="quiet-light-button" onClick={onClear}>{t('management.clear')}</button>
      <button type="submit" className="primary-button">{t('common.search')}</button>
    </div></div>
  </form>;
}
