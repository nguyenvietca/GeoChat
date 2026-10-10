import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { readFileSync } from 'node:fs';

// Execute the same trusted bootstrap that index.html loads before React.
new Function(readFileSync('public/theme.js', 'utf8'))();

afterEach(() => {
  cleanup();
  window.geochatTheme.setPreference('system');
  localStorage.clear();
  window.history.replaceState({}, '', '/');
});
