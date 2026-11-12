/**
 * Pure access logic, kept free of Firebase so it is trivially testable.
 * Mirrors the rules in firestore.rules: access requires `status: "active"`
 * AND at least one recognised role. Everything else fails closed.
 */
import { z } from 'zod';
import type { Role } from '@/config/permissions';
import { normalizeRoles } from '@/utils/permissions';
import { ACCESS_STATUSES, type UserProfile } from './types';

export type AccessDecision = { kind: 'granted'; roles: Role[] } | { kind: 'pending' } | { kind: 'disabled' };

export function decideAccess(profile: UserProfile | null): AccessDecision {
  if (!profile) return { kind: 'pending' };
  if (profile.status === 'disabled') return { kind: 'disabled' };
  if (profile.status === 'active' && profile.roles.length > 0) return { kind: 'granted', roles: profile.roles };
  return { kind: 'pending' };
}

/** Firestore Timestamp (or anything with toDate) → Date; otherwise null. */
// `.optional()` is required: in Zod 4 a transformed `unknown` is otherwise a
// REQUIRED key, which would reject records with a not-yet-written timestamp.
const timestamp = z
  .unknown()
  .optional()
  .transform((value) =>
    value && typeof (value as { toDate?: unknown }).toDate === 'function' ? (value as { toDate: () => Date }).toDate() : null,
  );

const nullableString = z.string().nullable().optional().transform((value) => value ?? null);

/**
 * Validates a raw `users/{uid}` document. Unknown roles are dropped and an
 * unknown status reads as "pending" — malformed data can only reduce access.
 */
export const userProfileSchema = z.object({
  uid: z.string(),
  email: nullableString,
  displayName: nullableString,
  photoURL: nullableString,
  roles: z
    .unknown()
    .optional()
    .transform((roles) => normalizeRoles({ roles })),
  status: z.enum(ACCESS_STATUSES).catch('pending'),
  createdAt: timestamp,
  lastSignInAt: timestamp,
  updatedAt: timestamp,
  updatedBy: nullableString,
});

export function parseUserProfile(uid: string, data: unknown): UserProfile | null {
  const result = userProfileSchema.safeParse({ ...(data as object), uid });
  return result.success ? result.data : null;
}
