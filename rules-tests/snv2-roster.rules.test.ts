/**
 * Proves PACU Hub's "approve → Req off in the SNV2 roster" write is accepted by
 * SNV2's REAL security rules (fixture copy), preserves the rest of the roster,
 * and that Undo restores it — using the same functions the app ships.
 */
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applyReqOff, removeReqOff, todayIso } from '../src/services/snv2/roster';
import { updateRoster } from '../src/services/snv2/rosterWrite';

let env: RulesTestEnvironment;
const MANAGER = 'mgr-uid';

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-snv2',
    firestore: { rules: readFileSync('rules-tests/fixtures/snv2.firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
  });
});
afterAll(() => env.cleanup());

// SNV2 "isManager()" = signed in with a password account.
const asManager = (uid = MANAGER): Firestore =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: 'password' } } as never).firestore() as unknown as Firestore;

const future = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return todayIso(d);
};

const roster = () => ({
  state: {
    ids: ['n0', 'n1'],
    names: ['Lina', 'Omar'],
    overrides: { [future(30)]: { n1: 'VAC' } },
    notes: {},
    lockedCycles: {},
    frozen: { keep: 'me' },
  },
  updatedAt: 1,
  rev: 7,
  clashes: [],
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, 'rosters', MANAGER), roster());
  });
});

describe('approve / undo against SNV2 rules', () => {
  it('approval writes Req off with rev+1, accepted by SNV2 rules, rest untouched', async () => {
    const db = asManager();
    const day = future(20);
    const out = await updateRoster(db, MANAGER, (s) => applyReqOff(s, { rnId: 'n0', dates: [day], reason: 'Exam', today: todayIso() }));
    expect(out.applied).toEqual([day]);

    const after = (await getDoc(doc(db, 'rosters', MANAGER))).data()!;
    expect(after.rev).toBe(8);
    expect(after.state.overrides[day]).toEqual({ n0: 'REQ' });
    expect(after.state.notes[day]).toEqual({ n0: 'Exam' });
    expect(after.state.frozen).toEqual({ keep: 'me' });
    expect(after.state.overrides[future(30)]).toEqual({ n1: 'VAC' });
  });

  it('undo restores the roster (rev+1 again)', async () => {
    const db = asManager();
    const day = future(20);
    const a = await updateRoster(db, MANAGER, (s) => applyReqOff(s, { rnId: 'n0', dates: [day], reason: 'Exam', today: todayIso() }));
    await updateRoster(db, MANAGER, (s) => removeReqOff(s, { rnId: 'n0', applied: a.applied, notesWritten: a.notesWritten, reason: 'Exam' }));
    const after = (await getDoc(doc(db, 'rosters', MANAGER))).data()!;
    expect(after.rev).toBe(9);
    expect(after.state.overrides).toEqual(roster().state.overrides);
    expect(after.state.notes).toEqual({});
  });

  it('nothing to apply → no write at all (rev unchanged)', async () => {
    const db = asManager();
    await updateRoster(db, MANAGER, (s) => applyReqOff(s, { rnId: 'n0', dates: ['2000-01-01'], reason: '', today: todayIso() }));
    expect((await getDoc(doc(db, 'rosters', MANAGER))).data()!.rev).toBe(7);
  });

  it("another account cannot write the manager's roster (SNV2 rules)", async () => {
    const other = asManager('someone-else');
    await assertFails(
      updateRoster(other, MANAGER, (s) => applyReqOff(s, { rnId: 'n0', dates: [future(20)], reason: '', today: todayIso() })),
    );
  });

  it('a stale rev is refused by SNV2 rules (no blind overwrite)', async () => {
    const db = asManager();
    await assertFails(setDoc(doc(db, 'rosters', MANAGER), { ...roster(), rev: 7 }));
    await assertSucceeds(setDoc(doc(db, 'rosters', MANAGER), { ...roster(), rev: 8 }));
  });
});
