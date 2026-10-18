import { useEffect, useSyncExternalStore } from 'react';
import { en, type MessageKey } from './en';
import { vi } from './vi';
import { apiMessages } from './apiMessages';

export type Language = 'en' | 'vi';
export const LANGUAGE_STORAGE_KEY = 'geochat.web.language';
const listeners = new Set<() => void>();
let memoryLanguage: Language | null = null;

export function getLanguage(): Language {
  if (memoryLanguage) return memoryLanguage;
  try { return localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'vi' ? 'vi' : 'en'; }
  catch { return 'en'; }
}

export function setLanguage(language: Language) {
  if (language !== 'en' && language !== 'vi') return;
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); memoryLanguage = null; }
  catch { memoryLanguage = language; }
  document.documentElement.lang = language;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) { memoryLanguage = null; listener(); }
  };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}

export function translate(key: MessageKey, values: Record<string, string | number> = {}) {
  const message = (getLanguage() === 'vi' ? vi[key] : en[key]) ?? en[key];
  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) => String(values[name] ?? placeholder));
}

// Compatibility for API messages until the server exposes stable error codes.
// Call only for application messages; never translate user-authored chat content.
const messageKeys = new Map<string, MessageKey>();
for (const key of Object.keys(en) as MessageKey[]) {
  messageKeys.set(key, key); messageKeys.set(en[key], key); messageKeys.set(vi[key], key);
}
for (const [message, key] of Object.entries(apiMessages)) messageKeys.set(message, key);

export function translateText(message: string): string {
  const key = messageKeys.get(message);
  if (key) return translate(key);
  const draftSuffix = ` ${en['chat.draftSaved']}`;
  const draftAt = message.indexOf(draftSuffix);
  if (draftAt >= 0) {
    const remainder = message.slice(draftAt + draftSuffix.length).trim();
    return `${translateText(message.slice(0, draftAt))} ${translate('chat.draftSaved')}${remainder ? ` ${translateText(remainder)}` : ''}`;
  }
  return message;
}

export function useLocale() {
  const language = useSyncExternalStore(subscribe, getLanguage, () => 'en' as const);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  return { language, setLanguage, t: translate, text: translateText };
}
