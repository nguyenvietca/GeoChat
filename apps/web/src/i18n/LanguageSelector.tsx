import { useId } from 'react';
import { useLocale, type Language } from './index';

export function LanguageSelector() {
  const { language, setLanguage, t } = useLocale();
  const id = useId();
  return <div className="language-selector">
    <label htmlFor={id}>{t('language.title')}</label>
    <select id={id} value={language} onChange={event => setLanguage(event.target.value as Language)}>
      <option value="en" lang="en">English</option>
      <option value="vi" lang="vi">Tiếng Việt</option>
    </select>
  </div>;
}
