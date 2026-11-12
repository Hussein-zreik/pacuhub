/**
 * Authentication service — the only module that talks to Firebase Auth.
 * Components use `useAuth()`; they never import from 'firebase/auth'.
 */
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { firebaseAuth } from '@/services/firebase/client';
import type { HubUser } from './types';

const provider = new GoogleAuthProvider();
// Always show the account chooser — essential on shared workstations so the
// next nurse doesn't silently inherit the previous nurse's Google session.
provider.setCustomParameters({ prompt: 'select_account' });

export const toHubUser = (user: User): HubUser => ({
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
  photoURL: user.photoURL,
});

export const authService = {
  /** Email + password — an account created in Firebase or via self sign-up. */
  async signInWithPassword(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(firebaseAuth(), email.trim(), password);
  },

  /**
   * Self-service sign-up. Creates the Firebase account and signs in, which the
   * auth listener turns into a PENDING access request — no access until an
   * admin approves. A verification email is sent best-effort (so password
   * reset works later); it never blocks the request.
   */
  async signUpWithPassword(email: string, password: string, displayName: string): Promise<void> {
    const { user } = await createUserWithEmailAndPassword(firebaseAuth(), email.trim(), password);
    const name = displayName.trim();
    if (name) await updateProfile(user, { displayName: name });
    try {
      await sendEmailVerification(user);
    } catch {
      /* non-critical: approval is the real gate */
    }
  },

  /** Sends Firebase's password-reset email. */
  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(firebaseAuth(), email.trim());
  },

  /** Popup first (keeps app state); falls back to redirect if popups are blocked. */
  async signInWithGoogle(): Promise<void> {
    const auth = firebaseAuth();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw error;
    }
  },

  /** Surfaces errors from a redirect-based sign-in after the page reloads. */
  async consumeRedirectResult(): Promise<void> {
    await getRedirectResult(firebaseAuth());
  },

  signOut: () => firebaseSignOut(firebaseAuth()),

  /** Subscribe to auth changes. Returns an unsubscribe function. */
  subscribe(listener: (user: HubUser | null, raw: User | null) => void): () => void {
    return onAuthStateChanged(firebaseAuth(), (user) => listener(user ? toHubUser(user) : null, user));
  },

  currentFirebaseUser: (): User | null => firebaseAuth().currentUser,
};

export function isEmailDomainAllowed(email: string | null, allowedDomains: readonly string[]): boolean {
  if (allowedDomains.length === 0) return true;
  const domain = email?.split('@')[1]?.toLowerCase();
  return !!domain && allowedDomains.includes(domain);
}
