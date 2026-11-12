/** App-level user shape. UI code depends on this, never on Firebase's `User`. */
export interface HubUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export type SignOutReason = 'user' | 'idle' | 'domain-not-allowed';
