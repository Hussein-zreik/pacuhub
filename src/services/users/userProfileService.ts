/**
 * Staff access records (`pacuhub_users/{uid}`) — the only module that reads or
 * writes them. Every write here is shaped to satisfy firestore.rules exactly;
 * see rules-tests/ for the executable specification.
 */
import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { firebaseAuth, firestore } from '@/services/firebase/client';
import { COLLECTIONS } from '@/services/firestore/collections';
import { logger } from '@/services/monitoring/logger';
import { parseUserProfile } from './access';
import type { AccessChange, UserProfile } from './types';

/** Upper bound for the staff list — far above unit size, protects memory. */
const MAX_STAFF = 500;

const userRef = (uid: string) => doc(firestore(), COLLECTIONS.users, uid);
const isPermissionDenied = (error: unknown) => (error as { code?: string }).code === 'permission-denied';

/**
 * Called on every sign-in. First-time users get a *pending* access request;
 * returning users get their name/photo/last-sign-in refreshed.
 */
export async function ensureUserProfile(user: User): Promise<void> {
  const ref = userRef(user.uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    try {
      // On self sign-up the display name is set moments earlier via
      // updateProfile; prefer the live currentUser so the first record has it.
      const displayName = firebaseAuth().currentUser?.displayName ?? user.displayName;
      await setDoc(ref, {
        uid: user.uid,
        email: user.email,
        displayName,
        photoURL: user.photoURL,
        access: {},
        status: 'pending',
        createdAt: serverTimestamp(),
        lastSignInAt: serverTimestamp(),
      });
      logger.info('Access request created', { uid: user.uid });
    } catch (error) {
      // Another tab may have created it a moment earlier — that's fine.
      if (isPermissionDenied(error)) {
        if ((await getDoc(ref)).exists()) return;
        // Refused by the rules: most often the unit's sign-up domain policy.
        throw Object.assign(new Error('Access request refused'), { code: 'pacuhub/request-refused' });
      }
      throw error;
    }
    return;
  }

  try {
    await updateDoc(ref, { displayName: user.displayName, photoURL: user.photoURL, lastSignInAt: serverTimestamp() });
  } catch (error) {
    // Non-critical bookkeeping: never block sign-in over it.
    logger.warn('Could not refresh profile details', { uid: user.uid, code: (error as { code?: string }).code });
  }
}

/**
 * Live subscription to one user's access record, so approvals and
 * revocations take effect in open sessions within seconds.
 */
export function watchUserProfile(
  uid: string,
  onChange: (profile: UserProfile | null) => void,
  onError: (error: unknown) => void,
): () => void {
  return onSnapshot(
    userRef(uid),
    (snapshot) => onChange(snapshot.exists() ? parseUserProfile(snapshot.id, snapshot.data({ serverTimestamps: 'estimate' })) : null),
    onError,
  );
}

/** Admin only (enforced by rules): every staff access record, newest first. */
export async function listUserProfiles(): Promise<UserProfile[]> {
  const snapshot = await getDocs(query(collection(firestore(), COLLECTIONS.users), orderBy('createdAt', 'desc'), limit(MAX_STAFF)));
  return snapshot.docs
    .map((d) => parseUserProfile(d.id, d.data({ serverTimestamps: 'estimate' })))
    .filter((profile): profile is UserProfile => profile !== null);
}

/**
 * Admin only (enforced by rules): set a user's access and/or status.
 * The WHOLE access map is written (never merged), so removed areas are
 * really removed.
 */
export async function updateUserAccess(uid: string, change: AccessChange, adminUid: string): Promise<void> {
  await updateDoc(userRef(uid), {
    access: { ...change.access },
    status: change.status,
    updatedAt: serverTimestamp(),
    updatedBy: adminUid,
  });
}
