import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getDataStore } from '@/repositories';
import { DEFAULT_SETTINGS } from '@/db/defaults';
import type { Settings } from '@/types';

const THEME_STORAGE_KEY = 'verse-memory:theme';

type SettingsContextValue = {
  settings: Settings;
  loaded: boolean;
  update: (changes: Partial<Settings>) => Promise<void>;
  reset: () => Promise<void>;
  reload: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function applyTheme(theme: Settings['theme'], reducedMotion: boolean): void {
  if (typeof document === 'undefined') return;

  const prefersDark = window.matchMedia?.(
    '(prefers-color-scheme: dark)',
  ).matches;
  const dark = theme === 'dark' || (theme === 'system' && prefersDark);

  document.documentElement.classList.toggle('dark', Boolean(dark));
  document.documentElement.classList.toggle('reduce-motion', reducedMotion);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private browsing modes can refuse storage; the theme still applies.
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const stored = await getDataStore().settings.get();
    setSettings(stored);
    applyTheme(stored.theme, stored.reducedMotion);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (settings.theme !== 'system') return;
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;

    const listener = () => applyTheme('system', settings.reducedMotion);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [settings.theme, settings.reducedMotion]);

  const update = useCallback(
    async (changes: Partial<Settings>) => {
      const next: Settings = {
        ...settings,
        ...changes,
        id: 'settings',
        updatedAt: new Date().toISOString(),
      };
      setSettings(next);
      applyTheme(next.theme, next.reducedMotion);
      await getDataStore().settings.save(next);
    },
    [settings],
  );

  const reset = useCallback(async () => {
    const fresh = await getDataStore().settings.reset();
    setSettings(fresh);
    applyTheme(fresh.theme, fresh.reducedMotion);
  }, []);

  const value = useMemo(
    () => ({ settings, loaded, update, reset, reload }),
    [settings, loaded, update, reset, reload],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used inside a SettingsProvider');
  }
  return context;
}
