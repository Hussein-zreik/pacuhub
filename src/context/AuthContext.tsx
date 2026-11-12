/**
 * Authentication + authorization state for the whole app.
 *
 * Modeled as an explicit state machine so every screen has exactly one thing
 * to render — no combinations of `loading && !error && user` booleans:
 *
 *   initializing ─┬─► signedOut
 *                 └─► resolving ─┬─► authorized   (has ≥1 role)
 *                                ├─► unauthorized (signed in, no role)
 *                                └─► error        (couldn't verify — retryable)
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from 'firebase/auth';
import { env } from '@/config/env';
import type { Capability, Role } from '@/config/permissions';
import { clearActivity, recordActivity } from '@/hooks/useIdleTimeout';
import { toFriendlyAuthError } from '@/services/auth/authErrors';
import { authService, isEmailDomainAllowed, toHubUser } from '@/services/auth/authService';
import { resolveRoles } from '@/services/auth/roleService';
import type { HubUser, SignOutReason } from '@/services/auth/types';
import { logger } from '@/services/monitoring/logger';
import { capabilitiesFor, hasAll } from '@/utils/permissions';

export type AuthState =
  | { status: 'initializing' }
  | { status: 'signedOut' }
  | { status: 'resolving'; user: HubUser }
  | { status: 'unauthorized'; user: HubUser }
  | { status: 'error'; user: HubUser; message: string }
  | { status: 'authorized'; user: HubUser; roles: Role[]; capabilities: ReadonlySet<Capability> };

export interface AuthContextValue {
  state: AuthState;
  isSigningIn: boolean;
  /** Plain-language sign-in error for the login screen, if any. */
  signInError: string | null;
  /** Why the last session ended (shown as a notice on the login screen). */
  lastSignOutReason: SignOutReason | null;
  signIn: () => Promise<void>;
  signOut: (reason?: SignOutReason) => Promise<void>;
  /** Re-check roles (e.g. after an admin grants access). Forces a token refresh. */
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

  const evaluate = useCallback(async (user: HubUser | null, raw: User | null, forceRefresh = false) => {
    const id = ++requestId.current;

    if (!user || !raw) {
      setState({ status: 'signedOut' });
      return;
    }

    if (!isEmailDomainAllowed(user.email, env.allowedEmailDomains)) {
      setLastSignOutReason('domain-not-allowed');
      await authService.signOut(); // auth listener then moves us to `signedOut`
      return;
    }

    setState({ status: 'resolving', user });
    try {
      const { roles } = await resolveRoles(raw, { forceRefresh });
      if (id !== requestId.current) return;
      setState(
        roles.length > 0
          ? { status: 'authorized', user, roles, capabilities: capabilitiesFor(roles) }
          : { status: 'unauthorized', user },
      );
    } catch (error) {
      if (id !== requestId.current) return;
      logger.error('Role resolution failed', error, { uid: user.uid });
      setState({
        status: 'error',
        user,
        message: 'We could not verify your access. Check the network connection and try again.',
      });
    }
  }, []);

  useEffect(() => {
    authService.consumeRedirectResult().catch((error: unknown) => {
      setSignInError(toFriendlyAuthError(error).message);
    });
    return authService.subscribe((user, raw) => void evaluate(user, raw));
  }, [evaluate]);

  const signIn = useCallback(async () => {
    setIsSigningIn(true);
    setSignInError(null);
    setLastSignOutReason(null);
    recordActivity(); // start a fresh inactivity window for the new session
    try {
      await authService.signInWithGoogle();
    } catch (error) {
      const friendly = toFriendlyAuthError(error);
      if (friendly.message) logger.warn('Sign-in failed', { code: friendly.code });
      setSignInError(friendly.message);
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signOut = useCallback(
    async (reason: SignOutReason = 'user') => {
      setLastSignOutReason(reason);
      clearActivity();
      // Drop every cached query so no clinical data survives into the next session.
      queryClient.clear();
      try {
        await authService.signOut();
      } catch (error) {
        logger.error('Sign-out failed', error);
        setState({ status: 'signedOut' }); // fail closed: hide the app regardless
      }
    },
    [queryClient],
  );

  const refreshAccess = useCallback(async () => {
    const raw = authService.currentFirebaseUser();
    if (!raw) return;
    await evaluate(toHubUser(raw), raw, true);
  }, [evaluate]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, isSigningIn, signInError, lastSignOutReason, signIn, signOut, refreshAccess }),
    [state, isSigningIn, signInError, lastSignOutReason, signIn, signOut, refreshAccess],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}

/** Capability checks for role-based UI. Safe to call in any auth state. */
export function usePermissions() {
  const { state } = useAuth();
  return useMemo(() => {
    const granted: ReadonlySet<Capability> = state.status === 'authorized' ? state.capabilities : new Set();
    const roles: Role[] = state.status === 'authorized' ? state.roles : [];
    return {
      roles,
      can: (required?: Capability | readonly Capability[]) => hasAll(granted, required),
    };
  }, [state]);
}
