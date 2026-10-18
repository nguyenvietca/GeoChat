import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi as testMock } from 'vitest';
import { en } from './en';
import { vi } from './vi';
import { getLanguage, LANGUAGE_STORAGE_KEY, setLanguage, translate, translateText } from './index';
import { LanguageSelector } from './LanguageSelector';

afterEach(() => { testMock.restoreAllMocks(); act(() => setLanguage('en')); });

it('provides both languages for every configured message', () => {
  expect(Object.keys(vi).sort()).toEqual(Object.keys(en).sort());
  expect(Object.values(vi).every(message => message.trim())).toBe(true);
  expect(translate('common.signOut')).toBe('Sign out');
  setLanguage('vi');
  expect(translate('common.signOut')).toBe('Đăng xuất');
  expect(translate('home.welcome', { name: 'Mira' })).toBe('Xin chào, Mira');
  expect(translate('notifications.bellLabel', { count: 3 })).toBe('Thông báo, 3 chưa đọc');
});

it('saves the choice, updates document language and restores it on remount', async () => {
  const view = render(<LanguageSelector />);
  fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'vi' } });
  expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('vi');
  expect(getLanguage()).toBe('vi');
  await waitFor(() => expect(document.documentElement.lang).toBe('vi'));
  expect((screen.getByLabelText('Ngôn ngữ') as HTMLSelectElement).value).toBe('vi');
  view.unmount(); render(<LanguageSelector />);
  expect((screen.getByLabelText('Ngôn ngữ') as HTMLSelectElement).value).toBe('vi');
});

it('handles another-tab changes and unsupported stored values safely', async () => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, 'unsupported');
  expect(getLanguage()).toBe('en');
  render(<LanguageSelector />);
  act(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'vi');
    window.dispatchEvent(new StorageEvent('storage', { key: LANGUAGE_STORAGE_KEY, newValue: 'vi' }));
  });
  expect(screen.getByLabelText('Ngôn ngữ')).toBeTruthy();
  await waitFor(() => expect(document.documentElement.lang).toBe('vi'));
});

it('still changes language in this tab when preference storage is blocked', () => {
  render(<LanguageSelector />);
  testMock.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'vi' } });
  expect(getLanguage()).toBe('vi');
  expect(screen.getByLabelText('Ngôn ngữ')).toBeTruthy();
});

it('localizes known API errors and draft feedback while preserving unknown messages', () => {
  setLanguage('vi');
  expect(translateText(en['profile.emailUsed'])).toBe(vi['profile.emailUsed']);
  expect(translateText('Internal server error')).toBe(vi['errors.server']);
  expect(translateText(`${en['errors.network']} ${en['chat.draftSaved']} ${en['chat.uncertain']}`))
    .toBe(`${vi['errors.network']} ${vi['chat.draftSaved']} ${vi['chat.uncertain']}`);
  expect(translateText('Unknown provider response')).toBe('Unknown provider response');
  setLanguage('en');
  expect(translateText(vi['profile.updated'])).toBe(en['profile.updated']);
});
