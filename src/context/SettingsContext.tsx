/**
 * Live unit settings + the signed-in person's preferences, available app-wide.
 *
 * - Public settings (sign-up, auto sign-out policy) load for everyone, even on
 *   the login screen. App settings load once a person is approved.
 * - Theme and text size are applied to <html>, and reset to the defaults the
 *   moment nobody is signed in — on a shared workstation the next person never
 *   inherits the previous person's display.
 * - Saving unit settings also writes an activity-log entry.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { logActivity } from '@/services/activity/activityLog';
import { logger } from '@/services/monitoring/logger';
import {
  DEFAULT_APP, DEFAULT_PREFS, DEFAULT_PUBLIC, effectiveIdle,
  type AppSettings, type PublicSettings, type UserPrefs,
} from '@/services/settings/model';
import {
  saveAppSettings, savePrefs as savePrefsDoc, savePublicSettings, watchAppSettings, watchPrefs, watchPublicSettings, type Stamp,
} from '@/services/settings/settingsService';

const NO_STAMP: Stamp = { updatedAt: null, updatedByName: null };

export interface SettingsContextValue {
  publicSettings: PublicSettings;
  appSettings: AppSettings;
  prefs: UserPrefs;
  publicStamp: Stamp;
  appStamp: Stamp;
  idle: ReturnType<typeof effectiveIdle>;
  savePrefs: (prefs: UserPrefs) => Promise<void>;
  savePublic: (settings: PublicSettings, summary: string) => Promise<void>;
  saveApp: (settings: AppSettings, summary: string) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function applyDisplay(prefs: UserPrefs | null) {
  const html = document.documentElement;
  const theme = prefs?.theme ?? 'light';
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  html.classList.toggle('dark', !!dark);
  html.dataset.textSize = prefs?.textSize ?? 'normal';
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const user = 'user' in state ? state.user : null;
  const authorized = state.status === 'authorized';
  const me = useMemo(() => (user ? { uid: user.uid, name: user.displayName || user.email || 'Unknown' } : null), [user]);

  const [publicSettings, setPublic] = useState<PublicSettings>(DEFAULT_PUBLIC);
  const [publicStamp, setPublicStamp] = useState<Stamp>(NO_STAMP);
  const [appSettings, setApp] = useState<AppSettings>(DEFAULT_APP);
  const [appStamp, setAppStamp] = useState<Stamp>(NO_STAMP);
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);

  useEffect(
    () =>
      watchPublicSettings(
        (s, stamp) => {
          setPublic(s);
          setPublicStamp(stamp);
        },
        (e) => logger.warn('Public settings unavailable — using defaults', { error: String(e) }),
      ),
    [],
  );

  useEffect(() => {
    if (!authorized) {
      setApp(DEFAULT_APP);
      return;
    }
    return watchAppSettings(
      (s, stamp) => {
        setApp(s);
        setAppStamp(stamp);
      },
      (e) => logger.warn('App settings unavailable — using defaults', { error: String(e) }),
    );
  }, [authorized]);

  const uid = me?.uid ?? null;
  useEffect(() => {
    if (!uid) {
      setPrefs(null);
      return;
    }
    return watchPrefs(uid, setPrefs, (e) => logger.warn('Preferences unavailable', { error: String(e) }));
  }, [uid]);

  // Display preferences apply only while that person is signed in.
  const displayPrefs = authorized ? prefs : null;
  useEffect(() => {
    applyDisplay(displayPrefs);
    if (displayPrefs?.theme !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyDisplay(displayPrefs);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [displayPrefs]);

  const savePrefs = useCallback(
    async (next: UserPrefs) => {
      if (!uid) throw new Error('Not signed in.');
      await savePrefsDoc(uid, next);
    },
    [uid],
  );

  const savePublic = useCallback(
    async (next: PublicSettings, summary: string) => {
      if (!me) throw new Error('Not signed in.');
      await savePublicSettings(next, me);
      await logActivity('settings', summary, me);
    },
    [me],
  );

  const saveApp = useCallback(
    async (next: AppSettings, summary: string) => {
      if (!me) throw new Error('Not signed in.');
      await saveAppSettings(next, me);
      await logActivity('settings', summary, me);
    },
    [me],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({
      publicSettings,
      appSettings,
      prefs: prefs ?? DEFAULT_PREFS,
      publicStamp,
      appStamp,
      idle: effectiveIdle(publicSettings, prefs),
      savePrefs,
      savePublic,
      saveApp,
    }),
    [publicSettings, appSettings, prefs, publicStamp, appStamp, savePrefs, savePublic, saveApp],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

const DETACHED: SettingsContextValue = {
  publicSettings: DEFAULT_PUBLIC,
  appSettings: DEFAULT_APP,
  prefs: DEFAULT_PREFS,
  publicStamp: NO_STAMP,
  appStamp: NO_STAMP,
  idle: effectiveIdle(DEFAULT_PUBLIC, null),
  savePrefs: async () => {
    throw new Error('Settings are not available here.');
  },
  savePublic: async () => {
    throw new Error('Settings are not available here.');
  },
  saveApp: async () => {
    throw new Error('Settings are not available here.');
  },
};

/** Outside a provider (isolated tests/previews) this returns the safe defaults, read-only. */
export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext) ?? DETACHED;
}
