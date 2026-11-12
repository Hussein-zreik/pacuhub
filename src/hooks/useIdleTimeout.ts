/**
 * Inactivity auto-logout for shared clinical workstations.
 *
 * Design notes:
 *  - Time is computed from timestamps, never by counting timer ticks. Browsers
 *    throttle timers in background tabs; timestamps stay correct regardless.
 *  - Last activity is shared across tabs via localStorage, so working in one
 *    tab keeps the others alive, and all tabs time out together.
 *  - On load, a stale timestamp (e.g. a browser re-opened an hour later)
 *    triggers an immediate sign-out instead of resuming the old session.
 *  - Once the warning is visible, passive activity (mouse jiggle) does NOT
 *    extend the session — the user must explicitly confirm they're present.
 *  - State only updates during the warning window, so the app does not
 *    re-render every second during normal use.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { storageKey } from '@/config/app';

export const ACTIVITY_STORAGE_KEY = storageKey('lastActivity');
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
const WRITE_THROTTLE_MS = 2_000;
const TICK_MS = 1_000;

export function readLastActivity(key = ACTIVITY_STORAGE_KEY): number | null {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null; // storage blocked (private mode / policy) — fall back to in-memory tracking
  }
}

export function recordActivity(key = ACTIVITY_STORAGE_KEY, at = Date.now()): void {
  try {
    window.localStorage.setItem(key, String(at));
  } catch {
    /* ignore — see readLastActivity */
  }
}

export function clearActivity(key = ACTIVITY_STORAGE_KEY): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export interface IdleTimeoutOptions {
  enabled: boolean;
  timeoutMs: number;
  warningMs: number;
  onTimeout: () => void;
  storageKey?: string;
}

export interface IdleTimeoutState {
  /** True while the "are you still there?" countdown is showing. */
  isWarning: boolean;
  /** Milliseconds left before sign-out (only meaningful while `isWarning`). */
  remainingMs: number;
  /** Explicitly confirm presence and restart the inactivity window. */
  stayActive: () => void;
}

export function useIdleTimeout({
  enabled,
  timeoutMs,
  warningMs,
  onTimeout,
  storageKey: key = ACTIVITY_STORAGE_KEY,
}: IdleTimeoutOptions): IdleTimeoutState {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  const stayActiveRef = useRef<() => void>(() => {});

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled) {
      setRemainingMs(null);
      return;
    }

    const stored = readLastActivity(key);
    let lastActivity = stored ?? Date.now();
    if (stored === null) recordActivity(key, lastActivity);
    let lastWrite = 0;
    let warning = false;
    let fired = false;

    const markActive = (force = false) => {
      const now = Date.now();
      lastActivity = now;
      if (force || now - lastWrite > WRITE_THROTTLE_MS) {
        lastWrite = now;
        recordActivity(key, now);
      }
    };

    const check = () => {
      if (fired) return;
      const shared = readLastActivity(key);
      if (shared !== null && shared > lastActivity) lastActivity = shared; // activity in another tab

      const remaining = timeoutMs - (Date.now() - lastActivity);
      if (remaining <= 0) {
        fired = true;
        setRemainingMs(null);
        onTimeoutRef.current();
        return;
      }
      warning = remaining <= warningMs;
      // Round to whole seconds so identical values let React skip re-renders.
      setRemainingMs(warning ? Math.ceil(remaining / 1000) * 1000 : null);
    };

    const onActivity = () => {
      if (!warning) markActive();
    };

    stayActiveRef.current = () => {
      warning = false;
      markActive(true);
      check();
    };

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    window.addEventListener('storage', check);
    document.addEventListener('visibilitychange', check);
    const interval = window.setInterval(check, TICK_MS);
    check();

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
      window.removeEventListener('storage', check);
      document.removeEventListener('visibilitychange', check);
      window.clearInterval(interval);
      stayActiveRef.current = () => {};
    };
  }, [enabled, timeoutMs, warningMs, key]);

  const stayActive = useCallback(() => stayActiveRef.current(), []);

  return { isWarning: remainingMs !== null, remainingMs: remainingMs ?? 0, stayActive };
}
