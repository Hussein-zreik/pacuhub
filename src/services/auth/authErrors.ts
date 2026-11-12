/** Maps Firebase Auth error codes to plain-language messages for clinical staff. */
export interface FriendlyAuthError {
  /** `null` means the user intentionally cancelled — show nothing. */
  message: string | null;
  code: string;
}

const MESSAGES: Record<string, string | null> = {
  'auth/popup-closed-by-user': null,
  'auth/cancelled-popup-request': null,
  'auth/user-cancelled': null,
  // Deliberately the same message for every credential failure, so the
  // screen never reveals whether an email address has an account.
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
  'auth/weak-password': 'Choose a longer password (at least 8 characters).',
  'auth/invalid-login-credentials': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/missing-email': 'Enter your email address.',
  'auth/network-request-failed': 'No network connection. Check the workstation connection and try again.',
  'auth/too-many-requests': 'Too many sign-in attempts. Please wait a minute and try again.',
  'auth/user-disabled': 'This account has been disabled. Contact your Nurse Manager.',
  'auth/unauthorized-domain': 'This web address is not authorized for sign-in. Contact IT support.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled for PACU Hub. Contact your Nurse Manager.',
  'auth/admin-restricted-operation': 'Your account is not authorized to use PACU Hub.',
  'auth/internal-error': 'Sign-in could not be completed. Please try again.',
};

export function toFriendlyAuthError(error: unknown): FriendlyAuthError {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : 'unknown';
  const raw = error instanceof Error ? error.message : '';

  // Blocking functions (server-side access checks) surface as internal errors.
  if (/BLOCKING_FUNCTION|PERMISSION_DENIED/i.test(raw)) {
    return { code, message: 'Your account is not authorized to use PACU Hub. Contact your Nurse Manager.' };
  }
  if (code in MESSAGES) return { code, message: MESSAGES[code] ?? null };
  return { code, message: 'Sign-in failed. Please try again or contact IT support.' };
}
