/**
 * Activity log: an append-only record of important actions taken in PACU Hub
 * (access changes, unit settings, day-off decisions). Entries can't be edited
 * or deleted (firestore.rules), and each is stamped with the real signed-in
 * user and server time. Admins can read it.
 *
 * Honest limit: entries are written by the app as actions happen, so this
 * records what was done THROUGH PACU Hub, not changes made directly in the
 * Firebase console.
 */
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/services/firebase/client';
import { COLLECTIONS } from '@/services/firestore/collections';
import { logger } from '@/services/monitoring/logger';

export const ACTIVITY_TYPES = ['access', 'settings', 'dayoff', 'schedule'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  summary: string;
  byName: string;
  at: Date | null;
}

/** Best effort: a failed log write never blocks the action itself. */
export async function logActivity(type: ActivityType, summary: string, by: { uid: string; name: string }): Promise<void> {
  try {
    await addDoc(collection(firestore(), COLLECTIONS.activity), {
      type,
      summary: summary.slice(0, 300),
      by: by.uid,
      byName: by.name.slice(0, 120),
      at: serverTimestamp(),
    });
  } catch (error) {
    logger.warn('Activity log write failed', { type, code: (error as { code?: string }).code });
  }
}

export function watchActivity(onData: (e: ActivityEntry[]) => void, onError: (e: unknown) => void, max = 200) {
  const q = query(collection(firestore(), COLLECTIONS.activity), orderBy('at', 'desc'), limit(max));
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const data = d.data({ serverTimestamps: 'estimate' });
          const at = data.at as { toDate?: () => Date } | undefined;
          return {
            id: d.id,
            type: (ACTIVITY_TYPES as readonly string[]).includes(data.type) ? (data.type as ActivityType) : 'settings',
            summary: String(data.summary ?? ''),
            byName: String(data.byName ?? ''),
            at: at && typeof at.toDate === 'function' ? at.toDate() : null,
          };
        }),
      ),
    onError,
  );
}
