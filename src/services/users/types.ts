import type { Role } from '@/config/permissions';

export const ACCESS_STATUSES = ['pending', 'active', 'disabled'] as const;
export type AccessStatus = (typeof ACCESS_STATUSES)[number];

/** A staff member's access record — `pacuhub_users/{uid}` in Firestore. */
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  roles: Role[];
  status: AccessStatus;
  createdAt: Date | null;
  lastSignInAt: Date | null;
  updatedAt: Date | null;
  /** uid of the admin who last changed this user's access. */
  updatedBy: string | null;
}

export interface AccessChange {
  roles: Role[];
  status: AccessStatus;
}
