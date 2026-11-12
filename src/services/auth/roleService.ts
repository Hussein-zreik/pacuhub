/**
 * Resolves the signed-in user's roles from the configured source.
 *
 * Supports both common Firebase patterns because the backend is pre-configured:
 *   - custom claims on the ID token (preferred: tamper-proof, no extra read)
 *   - a Firestore `users/{uid}` profile document
 *
 * Contract:
 *   - "no role found" / permission-denied  → resolves to `{ roles: [] }`
 *     (UI shows the Access Pending screen)
 *   - transient failures (offline, timeout) → throws
 *     (UI shows a retry screen — we never lock a nurse out because of Wi-Fi)
 */
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { env } from '@/config/env';
import { firestore } from '@/services/firebase/client';
import { normalizeRoles } from '@/utils/permissions';
import type { RoleResolution } from './types';

async function fromClaims(user: User, forceRefresh: boolean) {
  const token = await user.getIdTokenResult(forceRefresh);
  return normalizeRoles(token.claims as Record<string, unknown>);
}

async function fromFirestore(user: User) {
  try {
    const snapshot = await getDoc(doc(firestore(), env.usersCollection, user.uid));
    return snapshot.exists() ? normalizeRoles(snapshot.data()) : [];
  } catch (error) {
    if ((error as { code?: string }).code === 'permission-denied') return [];
    throw error;
  }
}

export async function resolveRoles(user: User, { forceRefresh = false } = {}): Promise<RoleResolution> {
  const source = env.roleSource;

  if (source === 'claims' || source === 'claims-firestore') {
    const roles = await fromClaims(user, forceRefresh);
    if (roles.length > 0 || source === 'claims') return { roles, source: roles.length ? 'claims' : 'none' };
  }

  const roles = await fromFirestore(user);
  return { roles, source: roles.length ? 'firestore' : 'none' };
}
