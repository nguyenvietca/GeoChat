import type { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { NotificationProvider } from './NotificationContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return <AuthProvider><NotificationProvider>{children}</NotificationProvider></AuthProvider>;
}
