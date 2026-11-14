/**
 * Pure access logic, kept free of Firebase so it is trivially testable.
 * Mirrors firestore.rules: access requires `status: "active"` AND at least one
 * granted area. Everything else fails closed.
 */
import { z } from 'zod';
import { hasAnyAccess, sanitizeAccess } from '@/core/permissions/catalog';
import type { AccessMap } from '@/core/permissions/types';
import { ACCESS_STATUSES, type UserProfile } from './types';

export type AccessDecision = { kind: 'granted'; access: AccessMap } | { kind: 'pending' } | { kind: 'disabled' };

export function decideAccess(profile: UserProfile | null): AccessDecision {
  if (!profile) return { kind: 'pending' };
  if (profile.status === 'disabled') return { kind: 'disabled' };
  if (profile.status === 'active' && hasAnyAccess(profile.access)) return { kind: 'granted', access: profile.access };
  return { kind: 'pending' };
}

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
 * Validates a raw `pacuhub_users/{uid}` document. Non-string levels are
 * dropped and an unknown status reads as "pending" — malformed data can only
 * reduce access, never grant it.
 */
export const userProfileSchema = z.object({
  uid: z.string(),
  email: nullableString,
  displayName: nullableString,
  photoURL: nullableString,
  access: z.unknown().optional().transform((raw) => sanitizeAccess(raw)),
  status: z.enum(ACCESS_STATUSES).catch('pending'),
  // Only the exact boolean true marks an owner; anything else is not an owner.
  owner: z.unknown().optional().transform((value) => value === true),
  createdAt: timestamp,
  lastSignInAt: timestamp,
  updatedAt: timestamp,
  updatedBy: nullableString,
  rosterId: nullableString,
});

export function parseUserProfile(uid: string, data: unknown): UserProfile | null {
  const result = userProfileSchema.safeParse({ ...(data as object), uid });
  return result.success ? result.data : null;
}
