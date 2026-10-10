import type { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { NotificationProvider } from './NotificationContext';
import { ThemeProvider } from './ThemeContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return <ThemeProvider><AuthProvider><NotificationProvider>{children}</NotificationProvider></AuthProvider></ThemeProvider>;
}
