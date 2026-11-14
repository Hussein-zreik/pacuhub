/**
 * Live bay board storage:
 *   pacuhub_bays/{id}          one document per bay (live status)
 *   pacuhub_bayboard/config    alert thresholds + unit capacity signal
 *   pacuhub_bay_events/{id}    append-only flow events (in / complete / out)
 *                              for today's statistics — no patient data
 * Every change is a transaction: it re-reads the bay, so two nurses tapping
 * the same bay at once can't overwrite each other.
 */
import {
  addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  setDoc, Timestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { firestore } from '@/services/firebase/client';
import { COLLECTIONS } from '@/services/firestore/collections';
import {
  applyAction, BAY_STATUSES, BAY_TAGS, BayActionError, CAPACITY_LEVELS, DEFAULT_CONFIG, DELAY_REASONS,
  type Bay, type BayAction, type BayEvent, type BoardConfig, type Stamp,
} from './model';

export interface Actor {
  uid: string;
  name: string;
}

const toDate = (v: unknown): Date | null => (v instanceof Timestamp ? v.toDate() : v && typeof (v as { toDate?: unknown }).toDate === 'function' ? (v as { toDate: () => Date }).toDate() : null);
const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T | null): T | null => ((list as readonly unknown[]).includes(v) ? (v as T) : fallback);

function parseBay(id: string, d: Record<string, unknown>): Bay {
  const nurse = d.nurse && typeof d.nurse === 'object' ? (d.nurse as Record<string, unknown>) : null;
  return {
    id,
    name: typeof d.name === 'string' ? d.name : 'Bay',
    order: typeof d.order === 'number' ? d.order : 0,
    status: oneOf(BAY_STATUSES, d.status, 'empty')!,
    nurse: nurse && typeof nurse.name === 'string' ? { uid: typeof nurse.uid === 'string' ? nurse.uid : null, name: nurse.name } : null,
    tags: Array.isArray(d.tags) ? BAY_TAGS.filter((t) => (d.tags as unknown[]).includes(t)) : [],
    delayReason: oneOf(DELAY_REASONS, d.delayReason, null),
    inRecoveryAt: toDate(d.inRecoveryAt),
    careCompleteAt: toDate(d.careCompleteAt),
    updatedAt: toDate(d.updatedAt),
    updatedByName: typeof d.updatedByName === 'string' ? d.updatedByName : null,
  };
}

function parseConfig(d: Record<string, unknown> | undefined): BoardConfig {
  if (!d) return DEFAULT_CONFIG;
  const th = (v: unknown, f: BoardConfig['recovery']) => {
    const o = v as { amber?: unknown; red?: unknown } | undefined;
    return typeof o?.amber === 'number' && typeof o?.red === 'number' && o.amber < o.red ? { amber: o.amber, red: o.red } : f;
  };
  const thresholds = (d.thresholds ?? {}) as Record<string, unknown>;
  const cap = (d.capacity ?? {}) as Record<string, unknown>;
  return {
    recovery: th(thresholds.recovery, DEFAULT_CONFIG.recovery),
    complete: th(thresholds.complete, DEFAULT_CONFIG.complete),
    capacity: { level: oneOf(CAPACITY_LEVELS, cap.level, 'green')!, note: typeof cap.note === 'string' ? cap.note : '' },
  };
}

const baysCol = () => collection(firestore(), COLLECTIONS.bays);
const configRef = () => doc(firestore(), COLLECTIONS.bayboard, 'config');

export function watchBays(onData: (bays: Bay[]) => void, onError: (e: unknown) => void): () => void {
  return onSnapshot(
    query(baysCol(), orderBy('order'), limit(60)),
    (snap) => onData(snap.docs.map((d) => parseBay(d.id, d.data({ serverTimestamps: 'estimate' })))),
    onError,
  );
}

export function watchBoardConfig(onData: (c: BoardConfig) => void, onError: (e: unknown) => void): () => void {
  return onSnapshot(configRef(), (snap) => onData(parseConfig(snap.exists() ? snap.data() : undefined)), onError);
}

export function watchTodayEvents(since: Date, onData: (e: BayEvent[]) => void, onError: (e: unknown) => void): () => void {
  const q = query(collection(firestore(), COLLECTIONS.bayEvents), where('at', '>=', Timestamp.fromDate(since)), orderBy('at'), limit(500));
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const x = d.data({ serverTimestamps: 'estimate' });
          return {
            id: d.id,
            bayId: String(x.bayId ?? ''),
            action: x.action === 'in' || x.action === 'complete' ? x.action : 'out',
            delayReason: oneOf(DELAY_REASONS, x.delayReason, null),
            recoveryMin: typeof x.recoveryMin === 'number' ? x.recoveryMin : null,
            waitMin: typeof x.waitMin === 'number' ? x.waitMin : null,
            at: toDate(x.at),
          } satisfies BayEvent;
        }),
      ),
    onError,
  );
}

const stamp = (s: Stamp) => (s === 'now' ? serverTimestamp() : s);

/** Run a bay action safely against the CURRENT bay (transaction). */
export async function runBayAction(bayId: string, action: BayAction, by: Actor): Promise<void> {
  const db = firestore();
  const ref = doc(db, COLLECTIONS.bays, bayId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new BayActionError('This bay no longer exists.');
    const current = parseBay(snap.id, snap.data());
    const { patch, event } = applyAction(current, action, new Date());
    tx.update(ref, {
      status: patch.status,
      nurse: patch.nurse,
      tags: patch.tags,
      delayReason: patch.delayReason,
      inRecoveryAt: stamp(patch.inRecoveryAt),
      careCompleteAt: stamp(patch.careCompleteAt),
      updatedAt: serverTimestamp(),
      updatedBy: by.uid,
      updatedByName: by.name.slice(0, 120),
    });
    if (event) {
      tx.set(doc(collection(db, COLLECTIONS.bayEvents)), {
        bayId,
        bayName: current.name.slice(0, 24),
        action: event.action,
        delayReason: event.delayReason,
        recoveryMin: event.recoveryMin,
        waitMin: event.waitMin,
        by: by.uid,
        at: serverTimestamp(),
      });
    }
  });
}

// ── Set-up (Manage level) ─────────────────────────────────────────────────

const meta = (by: Actor) => ({ updatedAt: serverTimestamp(), updatedBy: by.uid, updatedByName: by.name.slice(0, 120) });

export async function addBay(name: string, order: number, by: Actor): Promise<void> {
  await addDoc(baysCol(), {
    name: name.trim().slice(0, 24), order, status: 'empty', nurse: null, tags: [], delayReason: null,
    inRecoveryAt: null, careCompleteAt: null, ...meta(by),
  });
}

export async function renameBay(id: string, name: string, by: Actor): Promise<void> {
  await updateDoc(doc(baysCol(), id), { name: name.trim().slice(0, 24), ...meta(by) });
}

/** Swap two bays' positions. */
export async function swapBays(a: Bay, b: Bay, by: Actor): Promise<void> {
  const batch = writeBatch(firestore());
  batch.update(doc(baysCol(), a.id), { order: b.order, ...meta(by) });
  batch.update(doc(baysCol(), b.id), { order: a.order, ...meta(by) });
  await batch.commit();
}

/** Only an Empty or Closed bay can be removed (rules enforce this too). */
export async function deleteBay(id: string): Promise<void> {
  await deleteDoc(doc(baysCol(), id));
}

export async function saveBoardConfig(config: BoardConfig, by: Actor): Promise<void> {
  await setDoc(configRef(), {
    thresholds: { recovery: config.recovery, complete: config.complete },
    capacity: { level: config.capacity.level, note: config.capacity.note.trim().slice(0, 120) },
    ...meta(by),
  });
}
