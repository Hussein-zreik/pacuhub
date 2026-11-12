import type { AccessMap } from '@/core/permissions/types';

export const ACCESS_STATUSES = ['pending', 'active', 'disabled'] as const;
export type AccessStatus = (typeof ACCESS_STATUSES)[number];

/** A staff member's access record — `pacuhub_users/{uid}` in Firestore. */
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  /** Per-tab / per-area access levels. Empty = no access. */
  access: AccessMap;
  status: AccessStatus;
  /**
   * Owner ("master") account. Hidden from the Staff Access list for everyone
   * except the owner, and protected from any other admin. Set once by hand in
   * the Firebase console; it can never be changed through the app.
   */
  owner: boolean;
  createdAt: Date | null;
  lastSignInAt: Date | null;
  updatedAt: Date | null;
  /** uid of the admin who last changed this user's access. */
  updatedBy: string | null;
}

export interface AccessChange {
  access: AccessMap;
  status: AccessStatus;
}
