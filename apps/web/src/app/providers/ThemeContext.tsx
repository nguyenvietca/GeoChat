import { createContext, ReactNode, useContext, useMemo, useSyncExternalStore } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
type ThemeSnapshot = { preference: ThemePreference; resolved: 'light' | 'dark' };
declare global {
  interface Window {
    geochatTheme: {
      getSnapshot: () => ThemeSnapshot;
      subscribe: (listener: () => void) => () => void;
      setPreference: (preference: ThemePreference) => void;
      destroy: () => void;
    };
  }
}
const ThemeContext = createContext<(ThemeSnapshot & { setPreference: (preference: ThemePreference) => void }) | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const runtime = window.geochatTheme;
  const snapshot = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
  const value = useMemo(() => ({ ...snapshot, setPreference: runtime.setPreference }), [snapshot, runtime]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('ThemeProvider is required.');
  return theme;
}
