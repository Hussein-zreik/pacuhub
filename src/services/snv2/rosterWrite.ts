/**
 * Transactional write to SNV2's roster document (rosters/{managerUid}),
 * matching SNV2's own save (index.html pushCloud) field for field:
 *   { state, updatedAt: Date.now(), rev: rev + 1, clashes: last ≤5 }
 * SNV2's rules require rev == previous rev + 1, so a concurrent save by an SNV2
 * device makes this transaction retry on the newest roster instead of
 * overwriting it; SNV2 devices then merge our change through their normal sync.
 *
 * No path aliases: shared with the emulator tests.
 */
import { doc, runTransaction, type Firestore } from 'firebase/firestore';
import type { RosterState } from './roster';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export class RosterError extends Error {
  code: 'snv2/no-roster' | 'snv2/bad-roster';
  constructor(code: 'snv2/no-roster' | 'snv2/bad-roster', message: string) {
    super(message);
    this.code = code;
    this.name = 'RosterError';
  }
}

export async function updateRoster<T extends { state: RosterState; changed: boolean }>(
  db: Firestore,
  uid: string,
  mutate: (state: RosterState) => T,
): Promise<T> {
  const ref = doc(db, 'rosters', uid);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new RosterError('snv2/no-roster', 'No SNV2 roster found for this account.');
    const data = snap.data();
    if (!isObj(data.state)) throw new RosterError('snv2/bad-roster', 'The SNV2 roster could not be read.');
    const out = mutate(data.state);
    if (out.changed) {
      const rev = (Number.isInteger(data.rev) ? (data.rev as number) : 0) + 1;
      const clashes = Array.isArray(data.clashes) ? data.clashes.slice(-5) : [];
      tx.set(ref, { state: out.state, updatedAt: Date.now(), rev, clashes });
    }
    return out;
  });
}
