/**
 * Authentication + authorization state for the whole app.
 *
 * Modeled as an explicit state machine so every screen has exactly one thing
 * to render — no combinations of `loading && !error && user` booleans:
 *
 *   initializing ─┬─► signedOut
 *                 └─► resolving ─┬─► authorized   (status active + ≥1 granted area)
 *                                ├─► unauthorized (pending request, or deactivated)
 *                                └─► error        (couldn't verify — retryable)
 *
 * Access comes from the user's `pacuhub_users/{uid}` record, watched LIVE: when an
 * admin approves, changes or revokes access, every open session of that user
 * updates within seconds — no sign-out/sign-in needed.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from 'firebase/auth';
import { env } from '@/config/env';
import { sameAccess } from '@/core/permissions/catalog';
import type { AccessMap } from '@/core/permissions/types';
import { clearActivity, recordActivity } from '@/hooks/useIdleTimeout';
import { toFriendlyAuthError } from '@/services/auth/authErrors';
import { authService, isEmailDomainAllowed, toHubUser } from '@/services/auth/authService';
import type { HubUser, SignOutReason } from '@/services/auth/types';
import { logger } from '@/services/monitoring/logger';
import { decideAccess } from '@/services/users/access';
import { ensureUserProfile, watchUserProfile } from '@/services/users/userProfileService';

export type AuthState =
  | { status: 'initializing' }
  | { status: 'signedOut' }
  | { status: 'resolving'; user: HubUser }
  | { status: 'unauthorized'; user: HubUser; access: 'pending' | 'disabled' }
  | { status: 'error'; user: HubUser; message: string }
  | { status: 'authorized'; user: HubUser; access: AccessMap };

export interface AuthContextValue {
  state: AuthState;
  isSigningIn: boolean;
  /** Plain-language sign-in error for the login screen, if any. */
  signInError: string | null;
  /** Why the last session ended (shown as a notice on the login screen). */
  lastSignOutReason: SignOutReason | null;
  /** Email + password (shared with SNV2). */
  signInWithPassword: (email: string, password: string) => Promise<void>;
  /** Google — only offered when enabled in VITE_SIGN_IN_METHODS. */
  signInWithGoogle: () => Promise<void>;
  /** Resolves with an error message, or `null` when the reset email was requested. */
  sendPasswordReset: (email: string) => Promise<string | null>;
  clearSignInError: () => void;
  signOut: (reason?: SignOutReason) => Promise<void>;
  /** Re-check access (normally automatic via the live subscription). */
  refreshAccess: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'initializing' });
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [lastSignOutReason, setLastSignOutReason] = useState<SignOutReason | null>(null);

  // Guards against out-of-order async results (e.g. fast account switching).
  const requestId = useRef(0);
  const stopWatching = useRef<(() => void) | null>(null);

  const unwatch = useCallback(() => {
    stopWatching.current?.();
    stopWatching.current = null;
  }, []);

  const evaluate = useCallback(
    async (user: HubUser | null, raw: User | null) => {
      const id = ++requestId.current;
      unwatch();

      if (!user || !raw) {
        setState({ status: 'signedOut' });
        return;
      }

      if (!isEmailDomainAllowed(user.email, env.allowedEmailDomains)) {
        setLastSignOutReason('domain-not-allowed');
        await authService.signOut(); // auth listener then moves us to `signedOut`
        return;
      }

      const fail = (error: unknown) => {
        if (id !== requestId.current) return;
        logger.error('Access check failed', error, { uid: user.uid });
        setState({
          status: 'error',
          user,
          message: 'We could not verify your access. Check the network connection and try again.',
        });
      };

      setState({ status: 'resolving', user });
      try {
        await ensureUserProfile(raw);
      } catch (error) {
        fail(error);
        return;
      }
      if (id !== requestId.current) return;

      stopWatching.current = watchUserProfile(
        user.uid,
        (profile) => {
          if (id !== requestId.current) return;
          const decision = decideAccess(profile);
          if (decision.kind !== 'granted') queryClient.clear(); // revoked mid-session: drop cached data
          setState((previous) => {
            if (decision.kind !== 'granted') {
              const next = { status: 'unauthorized', user, access: decision.kind } as const;
              return previous.status === 'unauthorized' && previous.access === next.access ? previous : next;
            }
            // Keep the same object when nothing relevant changed, so a routine
            // profile update (e.g. last sign-in time) doesn't re-render the app.
            if (previous.status === 'authorized' && sameAccess(previous.access, decision.access)) return previous;
            return { status: 'authorized', user, access: decision.access };
          });
        },
        fail,
      );
    },
    [queryClient, unwatch],
  );

  useEffect(() => {
    authService.consumeRedirectResult().catch((error: unknown) => {
      setSignInError(toFriendlyAuthError(error).message);
    });
    const unsubscribe = authService.subscribe((user, raw) => void evaluate(user, raw));
    return () => {
      unsubscribe();
      unwatch();
    };
  }, [evaluate, unwatch]);

  /** Shared wrapper: one loading flag, one error channel, fresh idle window. */
  const runSignIn = useCallback(async (attempt: () => Promise<void>) => {
    setIsSigningIn(true);
    setSignInError(null);
    setLastSignOutReason(null);
    recordActivity(); // start a fresh inactivity window for the new session
    try {
      await attempt();
    } catch (error) {
      const friendly = toFriendlyAuthError(error);
      if (friendly.message) logger.warn('Sign-in failed', { code: friendly.code });
      setSignInError(friendly.message);
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signInWithPassword = useCallback(
    (email: string, password: string) => runSignIn(() => authService.signInWithPassword(email, password)),
    [runSignIn],
  );

  const signInWithGoogle = useCallback(() => runSignIn(() => authService.signInWithGoogle()), [runSignIn]);

  const sendPasswordReset = useCallback(async (email: string): Promise<string | null> => {
    try {
      await authService.sendPasswordReset(email);
      return null;
    } catch (error) {
      const code = (error as { code?: string }).code;
      // Never reveal whether an account exists for this email.
      if (code === 'auth/user-not-found') return null;
      return toFriendlyAuthError(error).message ?? 'Could not send the reset email. Please try again.';
    }
  }, []);

  const clearSignInError = useCallback(() => setSignInError(null), []);

  const signOut = useCallback(
    async (reason: SignOutReason = 'user') => {
      setLastSignOutReason(reason);
      clearActivity();
      unwatch();
      // Drop every cached query so no clinical data survives into the next session.
      queryClient.clear();
      try {
        await authService.signOut();
      } catch (error) {
        logger.error('Sign-out failed', error);
        setState({ status: 'signedOut' }); // fail closed: hide the app regardless
      }
    },
    [queryClient, unwatch],
  );

  const refreshAccess = useCallback(async () => {
    const raw = authService.currentFirebaseUser();
    if (!raw) return;
    await evaluate(toHubUser(raw), raw);
  }, [evaluate]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      isSigningIn,
      signInError,
      lastSignOutReason,
      signInWithPassword,
      signInWithGoogle,
      sendPasswordReset,
      clearSignInError,
      signOut,
      refreshAccess,
    }),
    [state, isSigningIn, signInError, lastSignOutReason, signInWithPassword, signInWithGoogle, sendPasswordReset, clearSignInError, signOut, refreshAccess],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
