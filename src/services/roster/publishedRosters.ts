/**
 * Published rosters in PACU Hub (`pacuhub_rosters/{cycleMonday}`).
 * Staff with Schedule access read them; the sync (schedule managers) writes.
 */
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore';
import { z } from 'zod';
import { firestore } from '@/services/firebase/client';
import { COLLECTIONS } from '@/services/firestore/collections';
import { fingerprint, type StoredRoster, type SyncPlan } from './published';

const rowSchema = z.object({ id: z.string(), name: z.string(), row: z.array(z.string()).length(14) });
const schema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lockedAt: z.string().catch(''),
  rns: z.array(rowSchema).catch([]),
  groups: z.array(z.object({ label: z.string(), rows: z.array(rowSchema) })).catch([]),
  shifts: z.array(z.object({ code: z.string(), label: z.string(), color: z.string() })).catch([]),
  fp: z.string().catch(''),
  syncedAt: z.unknown().optional().transform((v) => (v && typeof (v as { toDate?: unknown }).toDate === 'function' ? (v as { toDate: () => Date }).toDate() : null)),
});

/** Live list of published fortnights, oldest first. */
export function watchPublishedRosters(onData: (rosters: StoredRoster[]) => void, onError: (error: unknown) => void): () => void {
  const q = query(collection(firestore(), COLLECTIONS.rosters), orderBy('start'), limit(20));
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs
          .map((d) => schema.safeParse(d.data({ serverTimestamps: 'estimate' })))
          .flatMap((r) => (r.success ? [r.data] : [])),
      ),
    onError,
  );
}

/** Apply a sync plan in one atomic batch. */
export async function applySyncPlan(plan: SyncPlan, byUid: string): Promise<void> {
  const db = firestore();
  const batch = writeBatch(db);
  for (const r of plan.write) {
    batch.set(doc(db, COLLECTIONS.rosters, r.start), {
      start: r.start,
      lockedAt: r.lockedAt,
      rns: r.rns,
      groups: r.groups,
      shifts: r.shifts,
      fp: fingerprint(r),
      syncedAt: serverTimestamp(),
      syncedBy: byUid,
    });
  }
  for (const start of plan.remove) batch.delete(doc(db, COLLECTIONS.rosters, start));
  await batch.commit();
}
