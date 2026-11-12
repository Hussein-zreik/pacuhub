/**
 * Executable specification for firestore.rules → users/{uid}.
 * Each test is one sentence of the access policy. If a rule change breaks
 * one of these, the policy changed — make sure that was intended.
 */
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

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
  uid, email, displayName: 'Test User', photoURL: null, roles: [], status: 'pending',
  createdAt: serverTimestamp(), lastSignInAt: serverTimestamp(),
});

async function seed(uid: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, 'users', uid), {
      uid, email: `${uid}@aub.edu.lb`, displayName: uid, photoURL: null, roles: [], status: 'pending', ...data,
    });
  });
}

const adminUpdate = (adminUid: string, roles: string[], status: string) => ({
  roles, status, updatedAt: serverTimestamp(), updatedBy: adminUid,
});

describe('first sign-in (access request)', () => {
  it('a user can create their own pending request', async () => {
    await assertSucceeds(setDoc(doc(as('nurse'), 'users', 'nurse'), pendingRequest('nurse')));
  });

  it('cannot grant themselves roles on creation', async () => {
    await assertFails(setDoc(doc(as('nurse'), 'users', 'nurse'), { ...pendingRequest('nurse'), roles: ['admin'] }));
  });

  it('cannot create themselves as active', async () => {
    await assertFails(setDoc(doc(as('nurse'), 'users', 'nurse'), { ...pendingRequest('nurse'), status: 'active' }));
  });

  it("cannot create a record for someone else's uid", async () => {
    await assertFails(setDoc(doc(as('nurse'), 'users', 'other'), pendingRequest('other')));
  });

  it('cannot spoof a different email address', async () => {
    await assertFails(setDoc(doc(as('nurse'), 'users', 'nurse'), pendingRequest('nurse', 'manager@aub.edu.lb')));
  });

  it('cannot add unexpected fields', async () => {
    await assertFails(setDoc(doc(as('nurse'), 'users', 'nurse'), { ...pendingRequest('nurse'), isAdmin: true }));
  });

  it('requires a verified email', async () => {
    const db = env.authenticatedContext('nurse', { email: 'nurse@aub.edu.lb', email_verified: false }).firestore() as unknown as Firestore;
    await assertFails(setDoc(doc(db, 'users', 'nurse'), pendingRequest('nurse')));
  });

  it('signed-out visitors cannot create anything', async () => {
    await assertFails(setDoc(doc(anonymous(), 'users', 'nurse'), pendingRequest('nurse')));
  });
});

describe('self-service updates', () => {
  beforeEach(() => seed('nurse', { status: 'active', roles: ['staff_nurse'] }));

  it('a user can refresh their own name, photo and last sign-in', async () => {
    await assertSucceeds(
      updateDoc(doc(as('nurse'), 'users', 'nurse'), { displayName: 'New Name', photoURL: null, lastSignInAt: serverTimestamp() }),
    );
  });

  it('a user can NEVER change their own roles', async () => {
    await assertFails(updateDoc(doc(as('nurse'), 'users', 'nurse'), { roles: ['staff_nurse', 'admin'] }));
  });

  it('a user can NEVER change their own status', async () => {
    await seed('pending-nurse', { status: 'pending' });
    await assertFails(updateDoc(doc(as('pending-nurse'), 'users', 'pending-nurse'), { status: 'active' }));
  });

  it('a user cannot change their email', async () => {
    await assertFails(updateDoc(doc(as('nurse'), 'users', 'nurse'), { email: 'x@aub.edu.lb' }));
  });
});

describe('reading access records', () => {
  beforeEach(async () => {
    await seed('nurse', { status: 'active', roles: ['staff_nurse'] });
    await seed('charge', { status: 'active', roles: ['charge_nurse'] });
    await seed('boss', { status: 'active', roles: ['admin'] });
  });

  it('a user can read their own record', async () => {
    await assertSucceeds(getDoc(doc(as('nurse'), 'users', 'nurse')));
  });

  it("a non-admin cannot read someone else's record", async () => {
    await assertFails(getDoc(doc(as('charge'), 'users', 'nurse')));
  });

  it('a non-admin cannot list staff', async () => {
    await assertFails(getDocs(collection(as('charge'), 'users')));
  });

  it('an admin can list all staff', async () => {
    await assertSucceeds(getDocs(collection(as('boss'), 'users')));
  });

  it('signed-out visitors cannot read anything', async () => {
    await assertFails(getDoc(doc(anonymous(), 'users', 'nurse')));
  });
});

describe('admin access management', () => {
  beforeEach(async () => {
    await seed('boss', { status: 'active', roles: ['admin'] });
    await seed('new', { status: 'pending' });
  });

  it('an admin can approve a request with roles', async () => {
    await assertSucceeds(updateDoc(doc(as('boss'), 'users', 'new'), adminUpdate('boss', ['staff_nurse', 'charge_nurse'], 'active')));
  });

  it('an admin can deactivate a user (keeping roles)', async () => {
    await seed('leaver', { status: 'active', roles: ['staff_nurse'] });
    await assertSucceeds(updateDoc(doc(as('boss'), 'users', 'leaver'), adminUpdate('boss', ['staff_nurse'], 'disabled')));
  });

  it('an admin cannot activate someone with no roles', async () => {
    await assertFails(updateDoc(doc(as('boss'), 'users', 'new'), adminUpdate('boss', [], 'active')));
  });

  it('an admin cannot assign an unknown role', async () => {
    await assertFails(updateDoc(doc(as('boss'), 'users', 'new'), adminUpdate('boss', ['superuser'], 'active')));
  });

  it('an admin cannot set an unknown status', async () => {
    await assertFails(updateDoc(doc(as('boss'), 'users', 'new'), adminUpdate('boss', ['staff_nurse'], 'vip')));
  });

  it('an admin must record themselves as the editor', async () => {
    await assertFails(updateDoc(doc(as('boss'), 'users', 'new'), adminUpdate('someone-else', ['staff_nurse'], 'active')));
  });

  it("an admin cannot alter identity fields (email, uid, createdAt)", async () => {
    await assertFails(updateDoc(doc(as('boss'), 'users', 'new'), { ...adminUpdate('boss', ['staff_nurse'], 'active'), email: 'x@y.com' }));
  });

  it('an admin cannot change their OWN record (prevents self-lockout)', async () => {
    await assertFails(updateDoc(doc(as('boss'), 'users', 'boss'), adminUpdate('boss', ['staff_nurse'], 'active')));
  });

  it('a non-admin cannot change anyone', async () => {
    await seed('charge', { status: 'active', roles: ['charge_nurse'] });
    await assertFails(updateDoc(doc(as('charge'), 'users', 'new'), adminUpdate('charge', ['staff_nurse'], 'active')));
  });

  it('a pending user holding an admin role in their record has NO admin power', async () => {
    await seed('sneaky', { status: 'pending', roles: ['admin'] });
    await assertFails(updateDoc(doc(as('sneaky'), 'users', 'new'), adminUpdate('sneaky', ['staff_nurse'], 'active')));
    await assertFails(getDocs(collection(as('sneaky'), 'users')));
  });

  it('a deactivated admin loses admin power immediately', async () => {
    await seed('former', { status: 'disabled', roles: ['admin'] });
    await assertFails(updateDoc(doc(as('former'), 'users', 'new'), adminUpdate('former', ['staff_nurse'], 'active')));
  });

  it('nobody can delete records (audit trail)', async () => {
    await assertFails(deleteDoc(doc(as('boss'), 'users', 'new')));
    await assertFails(deleteDoc(doc(as('new'), 'users', 'new')));
  });
});

describe('everything else', () => {
  it('collections without rules are denied by default', async () => {
    await seed('boss', { status: 'active', roles: ['admin'] });
    await assertFails(setDoc(doc(as('boss'), 'anything', 'x'), { a: 1 }));
    await assertFails(getDoc(doc(as('boss'), 'anything', 'x')));
  });
});
