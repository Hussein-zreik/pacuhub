/**
 * Executable specification for firestore.rules → pacuhub_users/{uid}.
 * Each test is one sentence of the access policy. If a rule change breaks
 * one of these, the policy changed — make sure that was intended.
 */
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
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
