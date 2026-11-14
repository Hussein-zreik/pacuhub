/**
 * Approve / reject decisions on staff day-off requests, kept in PACU Hub's own
 * database (pacuhub_dayoff_decisions/{formId}__{requestId}). This is the
 * History list and what Undo works from: it records exactly which days an
 * approval wrote into the SNV2 roster, so Undo can remove precisely those.
 * Readable/writable only with "Manage schedule" (enforced in firestore.rules).
 */
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { z } from 'zod';
import { firestore } from '@/services/firebase/client';
import { COLLECTIONS } from '@/services/firestore/collections';

export type DecisionKind = 'approved' | 'rejected';

export interface DayOffDecision {
  id: string;
  formId: string;
  requestId: string;
  rnId: string;
  name: string;
  dates: string[];
  reason: string;
  decision: DecisionKind;
  /** Days actually written to the SNV2 roster as Req off. */
  applied: string[];
  notesWritten: string[];
  skipped: { date: string; why: string }[];
  decidedBy: string;
  decidedAt: Date | null;
}

export type DecisionInput = Omit<DayOffDecision, 'id' | 'decidedBy' | 'decidedAt'>;

export const decisionId = (formId: string, requestId: string) => `${formId}__${requestId}`;

const strList = z.array(z.string()).catch([]);
const schema = z.object({
  formId: z.string(),
  requestId: z.string(),
  rnId: z.string().catch(''),
  name: z.string().catch(''),
  dates: strList,
  reason: z.string().catch(''),
  decision: z.enum(['approved', 'rejected']),
  applied: strList,
  notesWritten: strList,
  skipped: z.array(z.object({ date: z.string(), why: z.string() })).catch([]),
  decidedBy: z.string().catch(''),
  decidedAt: z
    .unknown()
    .optional()
    .transform((v) => (v && typeof (v as { toDate?: unknown }).toDate === 'function' ? (v as { toDate: () => Date }).toDate() : null)),
});

const ref = (id: string) => doc(firestore(), COLLECTIONS.dayOffDecisions, id);

export function watchDecisions(formId: string, onData: (d: DayOffDecision[]) => void, onError: (e: unknown) => void): () => void {
  const q = query(collection(firestore(), COLLECTIONS.dayOffDecisions), where('formId', '==', formId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => {
          const r = schema.safeParse(d.data({ serverTimestamps: 'estimate' }));
          return r.success ? { ...r.data, id: d.id } : null;
        })
        .filter((d): d is DayOffDecision => d !== null)
        .sort((a, b) => (b.decidedAt?.getTime() ?? 0) - (a.decidedAt?.getTime() ?? 0));
      onData(list);
    },
    onError,
  );
}

export async function saveDecision(input: DecisionInput, uid: string): Promise<void> {
  await setDoc(ref(decisionId(input.formId, input.requestId)), {
    ...input,
    reason: input.reason.slice(0, 300),
    name: input.name.slice(0, 120),
    decidedBy: uid,
    decidedAt: serverTimestamp(),
  });
}

export async function deleteDecision(formId: string, requestId: string): Promise<void> {
  await deleteDoc(ref(decisionId(formId, requestId)));
}
