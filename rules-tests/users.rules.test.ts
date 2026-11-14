/**
 * Executable specification for firestore.rules → pacuhub_users/{uid}.
 * Each test is one sentence of the access policy. If a rule change breaks
 * one of these, the policy changed — make sure that was intended.
 */
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const USERS = 'pacuhub_users';
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-pacuhub',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const token = (email: string) => ({ email, email_verified: true });
const as = (uid: string, email = `${uid}@aub.edu.lb`): Firestore => env.authenticatedContext(uid, token(email)).firestore() as unknown as Firestore;
const anonymous = (): Firestore => env.unauthenticatedContext().firestore() as unknown as Firestore;

const pendingRequest = (uid: string, email = `${uid}@aub.edu.lb`) => ({
  uid, email, displayName: 'Test User', photoURL: null, access: {}, status: 'pending',
  createdAt: serverTimestamp(), lastSignInAt: serverTimestamp(),
});

async function seed(uid: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, USERS, uid), {
      uid, email: `${uid}@aub.edu.lb`, displayName: uid, photoURL: null, access: {}, status: 'pending', ...data,
    });
  });
}

const ADMIN = { 'staff-access': 'admin' };
const adminUpdate = (adminUid: string, access: Record<string, string>, status: string) => ({
  access, status, updatedAt: serverTimestamp(), updatedBy: adminUid,
});

describe('first sign-in (access request)', () => {
  it('a user can create their own pending request', async () => {
    await assertSucceeds(setDoc(doc(as('nurse'), USERS, 'nurse'), pendingRequest('nurse')));
  });

  it('cannot grant themselves access on creation', async () => {
    await assertFails(setDoc(doc(as('nurse'), USERS, 'nurse'), { ...pendingRequest('nurse'), access: ADMIN }));
  });

  it('cannot create themselves as active', async () => {
    await assertFails(setDoc(doc(as('nurse'), USERS, 'nurse'), { ...pendingRequest('nurse'), status: 'active' }));
  });

  it("cannot create a record for someone else's uid", async () => {
    await assertFails(setDoc(doc(as('nurse'), USERS, 'other'), pendingRequest('other')));
  });

  it('cannot spoof a different email address', async () => {
    await assertFails(setDoc(doc(as('nurse'), USERS, 'nurse'), pendingRequest('nurse', 'manager@aub.edu.lb')));
  });

  it('cannot add unexpected fields', async () => {
    await assertFails(setDoc(doc(as('nurse'), USERS, 'nurse'), { ...pendingRequest('nurse'), isAdmin: true }));
  });

  it('accepts unverified emails (accounts created by the Nurse Manager)', async () => {
    const db = env.authenticatedContext('nurse', { email: 'nurse@aub.edu.lb', email_verified: false }).firestore() as unknown as Firestore;
    await assertSucceeds(setDoc(doc(db, USERS, 'nurse'), pendingRequest('nurse')));
  });

  it('requires the account to have an email', async () => {
    const db = env.authenticatedContext('noemail', {}).firestore() as unknown as Firestore;
    await assertFails(setDoc(doc(db, USERS, 'noemail'), { ...pendingRequest('noemail'), email: null }));
  });

  it('signed-out visitors cannot create anything', async () => {
    await assertFails(setDoc(doc(anonymous(), USERS, 'nurse'), pendingRequest('nurse')));
  });
});

describe('self-service updates', () => {
  beforeEach(() => seed('nurse', { status: 'active', access: { schedule: 'view', forms: 'fill' } }));

  it('a user can refresh their own name, photo and last sign-in', async () => {
    await assertSucceeds(
      updateDoc(doc(as('nurse'), USERS, 'nurse'), { displayName: 'New Name', photoURL: null, lastSignInAt: serverTimestamp() }),
    );
  });

  it('a user can NEVER change their own access', async () => {
    await assertFails(updateDoc(doc(as('nurse'), USERS, 'nurse'), { access: { schedule: 'view', 'staff-access': 'admin' } }));
  });

  it('a user can NEVER change their own status', async () => {
    await seed('pending-nurse', { status: 'pending' });
    await assertFails(updateDoc(doc(as('pending-nurse'), USERS, 'pending-nurse'), { status: 'active' }));
  });

  it('a user cannot change their email', async () => {
    await assertFails(updateDoc(doc(as('nurse'), USERS, 'nurse'), { email: 'x@aub.edu.lb' }));
  });
});

describe('reading access records', () => {
  beforeEach(async () => {
    await seed('nurse', { status: 'active', access: { schedule: 'view', forms: 'fill' } });
    await seed('charge', { status: 'active', access: { forms: 'review' } });
    await seed('boss', { status: 'active', access: ADMIN });
  });

  it('a user can read their own record', async () => {
    await assertSucceeds(getDoc(doc(as('nurse'), USERS, 'nurse')));
  });

  it("a non-admin cannot read someone else's record", async () => {
    await assertFails(getDoc(doc(as('charge'), USERS, 'nurse')));
  });

  it('a non-admin cannot list staff', async () => {
    await assertFails(getDocs(collection(as('charge'), USERS)));
  });

  it('an admin can list all staff', async () => {
    await assertSucceeds(getDocs(collection(as('boss'), USERS)));
  });

  it('signed-out visitors cannot read anything', async () => {
    await assertFails(getDoc(doc(anonymous(), USERS, 'nurse')));
  });
});

describe('admin access management', () => {
  beforeEach(async () => {
    await seed('boss', { status: 'active', access: ADMIN });
    await seed('new', { status: 'pending' });
  });

  it('an admin can approve a request with per-tab access', async () => {
    await assertSucceeds(updateDoc(doc(as('boss'), USERS, 'new'), adminUpdate('boss', { schedule: 'view', 'audits:infection-control': 'enter' }, 'active')));
  });

  it('an admin can deactivate a user (keeping their access settings)', async () => {
    await seed('leaver', { status: 'active', access: { schedule: 'view', forms: 'fill' } });
    await assertSucceeds(updateDoc(doc(as('boss'), USERS, 'leaver'), adminUpdate('boss', { schedule: 'view' }, 'disabled')));
  });

  it('an admin cannot activate someone with no access', async () => {
    await assertFails(updateDoc(doc(as('boss'), USERS, 'new'), adminUpdate('boss', {}, 'active')));
  });

  it('an admin cannot store a non-map access value', async () => {
    await assertFails(updateDoc(doc(as('boss'), USERS, 'new'), { ...adminUpdate('boss', {}, 'active'), access: ['admin'] }));
  });

  it('an admin cannot set an unknown status', async () => {
    await assertFails(updateDoc(doc(as('boss'), USERS, 'new'), adminUpdate('boss', { schedule: 'view' }, 'vip')));
  });

  it('an admin must record themselves as the editor', async () => {
    await assertFails(updateDoc(doc(as('boss'), USERS, 'new'), adminUpdate('someone-else', { schedule: 'view' }, 'active')));
  });

  it("an admin cannot alter identity fields (email, uid, createdAt)", async () => {
    await assertFails(updateDoc(doc(as('boss'), USERS, 'new'), { ...adminUpdate('boss', { schedule: 'view' }, 'active'), email: 'x@y.com' }));
  });

  it('an admin can adjust their OWN tab access while keeping admin', async () => {
    await assertSucceeds(
      updateDoc(doc(as('boss'), USERS, 'boss'), {
        access: { ...ADMIN, schedule: 'view', 'audits:brief-op-notes': 'full' },
        updatedAt: serverTimestamp(),
        updatedBy: 'boss',
      }),
    );
  });

  it('an admin can NEVER remove their own admin level (prevents lockout)', async () => {
    await assertFails(
      updateDoc(doc(as('boss'), USERS, 'boss'), { access: { schedule: 'view' }, updatedAt: serverTimestamp(), updatedBy: 'boss' }),
    );
  });

  it('an admin can NEVER deactivate themselves', async () => {
    await assertFails(updateDoc(doc(as('boss'), USERS, 'boss'), adminUpdate('boss', ADMIN, 'disabled')));
  });

  it('a non-admin cannot change anyone', async () => {
    await seed('charge', { status: 'active', access: { forms: 'review' } });
    await assertFails(updateDoc(doc(as('charge'), USERS, 'new'), adminUpdate('charge', { schedule: 'view' }, 'active')));
  });

  it('a pending user holding an admin role in their record has NO admin power', async () => {
    await seed('sneaky', { status: 'pending', access: ADMIN });
    await assertFails(updateDoc(doc(as('sneaky'), USERS, 'new'), adminUpdate('sneaky', { schedule: 'view' }, 'active')));
    await assertFails(getDocs(collection(as('sneaky'), USERS)));
  });

  it('a deactivated admin loses admin power immediately', async () => {
    await seed('former', { status: 'disabled', access: ADMIN });
    await assertFails(updateDoc(doc(as('former'), USERS, 'new'), adminUpdate('former', { schedule: 'view' }, 'active')));
  });

  it('nobody can delete records (audit trail)', async () => {
    await assertFails(deleteDoc(doc(as('boss'), USERS, 'new')));
    await assertFails(deleteDoc(doc(as('new'), USERS, 'new')));
  });
});

describe('owner ("master") account protection', () => {
  beforeEach(async () => {
    await seed('owner', { status: 'active', access: ADMIN, owner: true });
    await seed('boss', { status: 'active', access: ADMIN });
    await seed('nurse', { status: 'active', access: { schedule: 'view' } });
  });

  it('a different admin cannot change an owner (no demote)', async () => {
    await assertFails(updateDoc(doc(as('boss'), USERS, 'owner'), adminUpdate('boss', { schedule: 'view' }, 'active')));
  });

  it('a different admin cannot deactivate an owner', async () => {
    await assertFails(updateDoc(doc(as('boss'), USERS, 'owner'), adminUpdate('boss', ADMIN, 'disabled')));
  });

  it('the owner can still adjust their own tabs (keeping admin)', async () => {
    await assertSucceeds(
      updateDoc(doc(as('owner'), USERS, 'owner'), {
        access: { ...ADMIN, schedule: 'manage' },
        updatedAt: serverTimestamp(),
        updatedBy: 'owner',
      }),
    );
  });

  it('nobody can add or change the owner flag through the app (console-only)', async () => {
    // an admin trying to promote a normal user to owner
    await assertFails(
      setDoc(doc(as('boss'), USERS, 'nurse'), { access: ADMIN, status: 'active', owner: true, updatedAt: serverTimestamp(), updatedBy: 'boss' }),
    );
    // an admin trying to drop the owner flag (by rewriting the record)
    await assertFails(
      setDoc(doc(as('boss'), USERS, 'owner'), { access: ADMIN, status: 'active', owner: false, updatedAt: serverTimestamp(), updatedBy: 'boss' }),
    );
  });

  it('the owner still cannot deactivate themselves', async () => {
    await assertFails(
      updateDoc(doc(as('owner'), USERS, 'owner'), { status: 'disabled', updatedAt: serverTimestamp(), updatedBy: 'owner' }),
    );
  });
});

describe('schedule settings (SNV2 staff request link)', () => {
  const SETTINGS = 'pacuhub_settings';
  const LINK = 'https://hussein-zreik.github.io/SNV2/request.html?f=AbCdEfGhIjKlMnOpQrSt12';
  const write = (uid: string, requestLink: unknown) =>
    setDoc(doc(as(uid), SETTINGS, 'schedule'), { requestLink, updatedAt: serverTimestamp(), updatedBy: uid });

  beforeEach(async () => {
    await seed('manager', { status: 'active', access: { schedule: 'manage' } });
    await seed('nurse', { status: 'active', access: { schedule: 'view' } });
    await seed('auditor', { status: 'active', access: { 'audits:infection-control': 'enter' } });
  });

  it('a schedule manager can set the link', async () => {
    await assertSucceeds(write('manager', LINK));
  });

  it('a schedule manager can clear the link', async () => {
    await assertSucceeds(write('manager', null));
  });

  it('staff with Schedule access can read it but not change it', async () => {
    await write('manager', LINK);
    await assertSucceeds(getDoc(doc(as('nurse'), SETTINGS, 'schedule')));
    await assertFails(write('nurse', LINK));
  });

  it('people without Schedule access cannot even read it', async () => {
    await assertFails(getDoc(doc(as('auditor'), SETTINGS, 'schedule')));
    await assertFails(getDoc(doc(anonymous(), SETTINGS, 'schedule')));
  });

  it('only genuine SNV2 request links are accepted (no look-alike or phishing links)', async () => {
    await assertFails(write('manager', 'https://evil.example/SNV2/request.html?f=AbCdEfGhIjKlMnOpQrSt12'));
    await assertFails(write('manager', 'https://hussein-zreik.github.io/SNV2/request.html?f=short'));
    await assertFails(write('manager', LINK + '&next=https://evil.example'));
    await assertFails(write('manager', 42));
  });

  it('a deactivated manager cannot change it', async () => {
    await seed('former', { status: 'disabled', access: { schedule: 'manage' } });
    await assertFails(write('former', LINK));
  });

  it('extra fields are rejected', async () => {
    await assertFails(
      setDoc(doc(as('manager'), SETTINGS, 'schedule'), { requestLink: LINK, updatedAt: serverTimestamp(), updatedBy: 'manager', x: 1 }),
    );
  });
});

describe('day-off decisions (History / Undo)', () => {
  const DEC = 'pacuhub_dayoff_decisions';
  const FORM = 'AbCdEfGhIjKlMnOpQrSt12';
  const decision = (uid: string, over: Record<string, unknown> = {}) => ({
    formId: FORM, requestId: 'req123', rnId: 'n0', name: 'Lina Saad', dates: ['2026-11-21'], reason: 'Exam',
    decision: 'approved', applied: ['2026-11-21'], notesWritten: ['2026-11-21'], skipped: [],
    decidedBy: uid, decidedAt: serverTimestamp(), ...over,
  });
  const id = `${FORM}__req123`;

  beforeEach(async () => {
    await seed('manager', { status: 'active', access: { schedule: 'manage' } });
    await seed('nurse', { status: 'active', access: { schedule: 'view' } });
  });

  it('a schedule manager can record, read and undo (delete) a decision', async () => {
    await assertSucceeds(setDoc(doc(as('manager'), DEC, id), decision('manager')));
    await assertSucceeds(getDoc(doc(as('manager'), DEC, id)));
    await assertSucceeds(deleteDoc(doc(as('manager'), DEC, id)));
  });

  it('staff without Manage schedule cannot read or write decisions', async () => {
    await assertFails(setDoc(doc(as('nurse'), DEC, id), decision('nurse')));
    await assertFails(getDoc(doc(as('nurse'), DEC, id)));
  });

  it('the record id must match the request it describes', async () => {
    await assertFails(setDoc(doc(as('manager'), DEC, `${FORM}__other`), decision('manager')));
  });

  it('a rejection can never claim roster days', async () => {
    await assertFails(setDoc(doc(as('manager'), DEC, id), decision('manager', { decision: 'rejected' })));
    await assertSucceeds(setDoc(doc(as('manager'), DEC, id), decision('manager', { decision: 'rejected', applied: [], notesWritten: [] })));
  });

  it('must be stamped with the real decider and unknown fields are refused', async () => {
    await assertFails(setDoc(doc(as('manager'), DEC, id), decision('someone-else')));
    await assertFails(setDoc(doc(as('manager'), DEC, id), { ...decision('manager'), extra: 1 }));
  });
});

async function seedSettings(id: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, 'pacuhub_settings', id), data);
  });
}

describe('unit settings', () => {
  const pub = (uid: string, over: Record<string, unknown> = {}) => ({
    signup: { enabled: true, allowedDomains: [] }, idle: { maxMinutes: 5, warningSeconds: 60 },
    updatedAt: serverTimestamp(), updatedBy: uid, updatedByName: 'Admin', ...over,
  });
  const app = (uid: string, over: Record<string, unknown> = {}) => ({
    shifts: { dayStart: '07:00', dayEnd: '19:00' }, announcement: null, defaultTemplate: 'staff-nurse',
    updatedAt: serverTimestamp(), updatedBy: uid, updatedByName: 'Admin', ...over,
  });

  beforeEach(async () => {
    await seed('boss', { status: 'active', access: ADMIN });
    await seed('nurse', { status: 'active', access: { schedule: 'view' } });
  });

  it('public settings are readable by anyone (login screen) but writable only by admins', async () => {
    await assertSucceeds(setDoc(doc(as('boss'), 'pacuhub_settings', 'public'), pub('boss')));
    await assertSucceeds(getDoc(doc(anonymous(), 'pacuhub_settings', 'public')));
    await assertFails(setDoc(doc(as('nurse'), 'pacuhub_settings', 'public'), pub('nurse')));
  });

  it('auto sign-out can never be switched off or set very long', async () => {
    for (const maxMinutes of [0, 1, 31, 600]) {
      await assertFails(setDoc(doc(as('boss'), 'pacuhub_settings', 'public'), pub('boss', { idle: { maxMinutes, warningSeconds: 60 } })));
    }
    await assertSucceeds(setDoc(doc(as('boss'), 'pacuhub_settings', 'public'), pub('boss', { idle: { maxMinutes: 30, warningSeconds: 60 } })));
  });

  it('settings changes must be stamped with the real admin', async () => {
    await assertFails(setDoc(doc(as('boss'), 'pacuhub_settings', 'public'), pub('someone-else')));
  });

  it('app settings: active staff read; admins write valid values only', async () => {
    await assertSucceeds(setDoc(doc(as('boss'), 'pacuhub_settings', 'app'), app('boss')));
    await assertSucceeds(getDoc(doc(as('nurse'), 'pacuhub_settings', 'app')));
    await assertFails(getDoc(doc(anonymous(), 'pacuhub_settings', 'app')));
    await assertFails(setDoc(doc(as('nurse'), 'pacuhub_settings', 'app'), app('nurse')));
    await assertFails(setDoc(doc(as('boss'), 'pacuhub_settings', 'app'), app('boss', { shifts: { dayStart: '25:00', dayEnd: '19:00' } })));
    await assertFails(setDoc(doc(as('boss'), 'pacuhub_settings', 'app'), app('boss', { defaultTemplate: 'superuser' })));
    await assertSucceeds(
      setDoc(doc(as('boss'), 'pacuhub_settings', 'app'), app('boss', { announcement: { text: 'Fire drill Tuesday', tone: 'warning', expiresOn: null } })),
    );
  });
});

describe('personal preferences', () => {
  const prefs = (over: Record<string, unknown> = {}) => ({
    theme: 'dark', textSize: 'large', startPage: 'schedule', idleMinutes: null, updatedAt: serverTimestamp(), ...over,
  });
  beforeEach(() => seed('nurse', { status: 'active', access: { schedule: 'view' } }));

  it('each person reads and writes only their own', async () => {
    await assertSucceeds(setDoc(doc(as('nurse'), 'pacuhub_prefs', 'nurse'), prefs()));
    await assertSucceeds(getDoc(doc(as('nurse'), 'pacuhub_prefs', 'nurse')));
    await assertFails(getDoc(doc(as('other'), 'pacuhub_prefs', 'nurse')));
    await assertFails(setDoc(doc(as('other'), 'pacuhub_prefs', 'nurse'), prefs()));
  });

  it('a personal sign-out time may only be shorter than the unit maximum', async () => {
    // no unit settings yet → default maximum is 5
    await assertSucceeds(setDoc(doc(as('nurse'), 'pacuhub_prefs', 'nurse'), prefs({ idleMinutes: 5 })));
    await assertFails(setDoc(doc(as('nurse'), 'pacuhub_prefs', 'nurse'), prefs({ idleMinutes: 6 })));
    await seedSettings('public', { signup: { enabled: true, allowedDomains: [] }, idle: { maxMinutes: 10, warningSeconds: 60 } });
    await assertSucceeds(setDoc(doc(as('nurse'), 'pacuhub_prefs', 'nurse'), prefs({ idleMinutes: 10 })));
    await assertFails(setDoc(doc(as('nurse'), 'pacuhub_prefs', 'nurse'), prefs({ idleMinutes: 11 })));
    await assertFails(setDoc(doc(as('nurse'), 'pacuhub_prefs', 'nurse'), prefs({ idleMinutes: 1 })));
  });

  it('rejects unknown values', async () => {
    await assertFails(setDoc(doc(as('nurse'), 'pacuhub_prefs', 'nurse'), prefs({ theme: 'neon' })));
  });
});

describe('activity log (append-only)', () => {
  const entry = (by: string) => ({ type: 'access', summary: 'Gave Lina Schedule', by, byName: 'Admin', at: serverTimestamp() });
  beforeEach(async () => {
    await seed('boss', { status: 'active', access: ADMIN });
    await seed('manager', { status: 'active', access: { schedule: 'manage' } });
  });

  it('active staff can append their own entries; only admins can read', async () => {
    await assertSucceeds(addDoc(collection(as('manager'), 'pacuhub_activity'), entry('manager')));
    await assertFails(addDoc(collection(as('manager'), 'pacuhub_activity'), entry('boss'))); // can't impersonate
    await assertFails(getDocs(collection(as('manager'), 'pacuhub_activity')));
    await assertSucceeds(getDocs(collection(as('boss'), 'pacuhub_activity')));
  });

  it('entries can never be edited or deleted — not even by an admin', async () => {
    const ref = await addDoc(collection(as('boss'), 'pacuhub_activity'), entry('boss'));
    await assertFails(updateDoc(doc(as('boss'), 'pacuhub_activity', ref.id), { summary: 'edited' }));
    await assertFails(deleteDoc(doc(as('boss'), 'pacuhub_activity', ref.id)));
  });

  it('pending (unapproved) users cannot write to the log', async () => {
    await seed('pend', { status: 'pending' });
    await assertFails(addDoc(collection(as('pend'), 'pacuhub_activity'), entry('pend')));
  });
});

describe('sign-up domain restriction', () => {
  it('when a domain list is set, only those emails can create an access request', async () => {
    await seedSettings('public', { signup: { enabled: true, allowedDomains: ['aub.edu.lb'] }, idle: { maxMinutes: 5, warningSeconds: 60 } });
    await assertFails(setDoc(doc(as('g1', 'g1@gmail.com'), USERS, 'g1'), pendingRequest('g1', 'g1@gmail.com')));
    await assertSucceeds(setDoc(doc(as('a1', 'a1@AUB.edu.lb'), USERS, 'a1'), pendingRequest('a1', 'a1@AUB.edu.lb')));
  });

  it('with no list set, any email can request access', async () => {
    await assertSucceeds(setDoc(doc(as('g2', 'g2@gmail.com'), USERS, 'g2'), pendingRequest('g2', 'g2@gmail.com')));
  });
});

describe('roster link (account ↔ SNV2 name)', () => {
  beforeEach(async () => {
    await seed('admin', { status: 'active', access: ADMIN });
    await seed('nurse', { status: 'active', access: { schedule: 'view' } });
  });

  it('an admin can link a staff account to a roster name', async () => {
    await assertSucceeds(updateDoc(doc(as('admin'), USERS, 'nurse'), { ...adminUpdate('admin', { schedule: 'view' }, 'active'), rosterId: 'rn4' }));
  });

  it('an admin can link their own account', async () => {
    await assertSucceeds(updateDoc(doc(as('admin'), USERS, 'admin'), { access: ADMIN, rosterId: 'rn1', updatedAt: serverTimestamp(), updatedBy: 'admin' }));
  });

  it('a nurse cannot link themselves to someone else’s row', async () => {
    await assertFails(updateDoc(doc(as('nurse'), USERS, 'nurse'), { rosterId: 'rn9' }));
  });

  it('rejects an oversized roster id', async () => {
    await assertFails(updateDoc(doc(as('admin'), USERS, 'nurse'), { ...adminUpdate('admin', { schedule: 'view' }, 'active'), rosterId: 'x'.repeat(41) }));
  });
});

describe('published roster', () => {
  const ROSTERS = 'pacuhub_rosters';
  const fortnight = (by: string, over: Record<string, unknown> = {}) => ({
    start: '2026-11-30', lockedAt: '2026-11-20T10:00:00.000Z',
    rns: [{ id: 'rn1', name: 'Lina', row: Array(14).fill('D7') }], groups: [], shifts: [],
    fp: 'abcd1234', syncedAt: serverTimestamp(), syncedBy: by, ...over,
  });
  beforeEach(async () => {
    await seed('manager', { status: 'active', access: { schedule: 'manage' } });
    await seed('nurse', { status: 'active', access: { schedule: 'view' } });
    await seed('auditor', { status: 'active', access: { 'audits:infection-control': 'enter' } });
    await seed('admin', { status: 'active', access: ADMIN });
  });

  it('a schedule manager (the sync) can publish a fortnight', async () => {
    await assertSucceeds(setDoc(doc(as('manager'), ROSTERS, '2026-11-30'), fortnight('manager')));
  });

  it('staff with Schedule access, and admins, can read it; others cannot', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore() as unknown as Firestore, ROSTERS, '2026-11-30'), fortnight('manager')));
    await assertSucceeds(getDoc(doc(as('nurse'), ROSTERS, '2026-11-30')));
    await assertSucceeds(getDoc(doc(as('admin'), ROSTERS, '2026-11-30')));
    await assertFails(getDoc(doc(as('auditor'), ROSTERS, '2026-11-30')));
    await assertFails(getDoc(doc(anonymous(), ROSTERS, '2026-11-30')));
  });

  it('a nurse with view access cannot publish or change it', async () => {
    await assertFails(setDoc(doc(as('nurse'), ROSTERS, '2026-11-30'), fortnight('nurse')));
  });

  it('cannot smuggle extra fields such as comments', async () => {
    await assertFails(setDoc(doc(as('manager'), ROSTERS, '2026-11-30'), fortnight('manager', { notes: { '2026-12-01': { rn1: 'private' } } })));
  });

  it('the document id must match the fortnight start', async () => {
    await assertFails(setDoc(doc(as('manager'), ROSTERS, '2026-12-14'), fortnight('manager')));
  });

  it('a manager can remove an unlocked fortnight; a nurse cannot', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore() as unknown as Firestore, ROSTERS, '2026-11-30'), fortnight('manager')));
    await assertFails(deleteDoc(doc(as('nurse'), ROSTERS, '2026-11-30')));
    await assertSucceeds(deleteDoc(doc(as('manager'), ROSTERS, '2026-11-30')));
  });
});

describe('everything else', () => {
  it("grants nothing on collections outside PACU Hub's (e.g. `users`)", async () => {
    await seed('boss', { status: 'active', access: ADMIN });
    await assertFails(getDoc(doc(as('boss'), 'users', 'boss')));
    await assertFails(setDoc(doc(as('boss'), 'users', 'boss'), { role: 'admin' }));
  });

  it('collections without rules are denied by default', async () => {
    await seed('boss', { status: 'active', access: ADMIN });
    await assertFails(setDoc(doc(as('boss'), 'anything', 'x'), { a: 1 }));
    await assertFails(getDoc(doc(as('boss'), 'anything', 'x')));
  });
});
