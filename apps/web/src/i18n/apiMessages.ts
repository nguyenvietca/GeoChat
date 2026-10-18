import type { MessageKey } from './en';

// Existing server wording is an adapter, not a translation key or UI label.
export const apiMessages: Record<string, MessageKey> = {
  'Internal server error': 'errors.server',
  'Invalid username or password': 'auth.invalidCredentials',
  'Invalid username or password.': 'auth.invalidCredentials',
  'Your session has expired. Please sign in again.': 'auth.sessionExpired',
  'Too many requests. Please wait and try again.': 'errors.rateLimited',
  'Service temporarily unavailable. Please try again.': 'errors.temporary',
  'This email is already in use. Please choose a different email address.': 'profile.emailUsed',
  'Email must be valid': 'profile.emailInvalid',
  'Display name must be between 2 and 100 characters': 'auth.nameLength',
  'Google sign-in is currently unavailable.': 'google.disabled',
  'Google cannot be connected to this account.': 'google.linkConflict',
  'A different Google account is already connected.': 'google.otherIdentity',
  'Sign in using your existing method, then connect Google in Settings.': 'google.emailCollision',
  'Your session changed. Sign in and connect Google again.': 'google.sessionChanged',
  'Confirm your current password; keep a usable password sign-in method.': 'google.confirmFailed',
  'Registration verification failed or expired. Please verify again.': 'verification.failed',
};
