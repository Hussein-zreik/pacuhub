/**
 * Reads staff day-off requests from SNV2's OWN Firebase project so they can be
 * shown inside PACU Hub's Schedule tab.
 *
 * Why this is its own, separate connection:
 *   - SNV2 keeps requests (which include staff names and private reasons)
 *     readable ONLY by the manager account that owns the request form. So PACU
 *     Hub must authenticate to SNV2's project AS that manager.
 *   - PACU Hub and SNV2 are different Firebase projects. We open a second,
 *     named Firebase app ("snv2") pointed at SNV2's project. PACU Hub's own
 *     data and auth are untouched.
 *   - The SNV2 session uses per-tab (session) persistence and is cleared on
 *     PACU Hub sign-out, so nothing lingers on a shared workstation.
 *
 * This module is the ONLY place that talks to SNV2's project.
 */
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserSessionPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { z } from 'zod';
import { env } from '@/config/env';
import { logger } from '@/services/monitoring/logger';
import { applyReqOff, removeReqOff, todayIso } from './roster';
import { RosterError, updateRoster } from './rosterWrite';

const APP_NAME = 'snv2';

export const isSnv2Configured = (): boolean => env.snv2Firebase !== null;

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;

function snv2App(): FirebaseApp {
  if (!env.snv2Firebase) throw new Error('SNV2 Firebase is not configured.');
  if (appInstance) return appInstance;
  appInstance = getApps().find((a) => a.name === APP_NAME) ?? initializeApp(env.snv2Firebase, APP_NAME);
  return appInstance;
}

function snv2Auth(): Auth {
  if (authInstance) return authInstance;
  // Session persistence: the SNV2 login lives only until the tab closes.
  authInstance = initializeAuth(snv2App(), { persistence: browserSessionPersistence });
  return authInstance;
}

const snv2Db = (): Firestore => getFirestore(snv2App());

export interface Snv2Manager {
  uid: string;
  email: string | null;
}

export interface DayOffRequest {
  id: string;
  /** SNV2 nurse id (matches the roster's ids). */
  rnId: string;
  name: string;
  /** ISO dates (YYYY-MM-DD) requested off. */
  dates: string[];
  reason: string;
  done: boolean;
  createdAt: Date | null;
}

const timestamp = z
  .unknown()
  .optional()
  .transform((v) => (v && typeof (v as { toDate?: unknown }).toDate === 'function' ? (v as { toDate: () => Date }).toDate() : null));

const requestSchema = z.object({
  rnId: z.string().catch(''),
  name: z.string().catch(''),
  dates: z.string().catch(''),
  reason: z.string().catch(''),
  done: z.unknown().optional().transform((v) => v === true),
  createdAt: timestamp,
});

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function parseRequest(id: string, data: unknown): DayOffRequest | null {
  const result = requestSchema.safeParse(data);
  if (!result.success) return null;
  const { rnId, name, dates, reason, done, createdAt } = result.data;
  return { id, rnId, name, dates: dates.split(',').map((d) => d.trim()).filter((d) => ISO.test(d)), reason, done, createdAt };
}

export const snv2Requests = {
  /** Sign the manager into SNV2's project (email + password). */
  async signIn(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(snv2Auth(), email.trim(), password);
  },

  /** Sign out of SNV2. Safe no-op if never connected (won't initialize anything). */
  async signOut(): Promise<void> {
    if (!getApps().some((a) => a.name === APP_NAME)) return;
    try {
      await signOut(snv2Auth());
    } catch (error) {
      logger.warn('SNV2 sign-out failed', { code: (error as { code?: string }).code });
    }
  },

  /** Subscribe to the SNV2 session (the connected manager, or null). */
  watchSession(listener: (manager: Snv2Manager | null) => void): () => void {
    if (!isSnv2Configured()) {
      listener(null);
      return () => {};
    }
    return onAuthStateChanged(snv2Auth(), (user: User | null) => listener(user ? { uid: user.uid, email: user.email } : null));
  },

  /** Live subscription to a form's day-off requests (newest first). */
  watchRequests(formId: string, onData: (requests: DayOffRequest[]) => void, onError: (error: unknown) => void): () => void {
    const ref = query(collection(snv2Db(), 'requestForms', formId, 'requests'), orderBy('createdAt', 'desc'), limit(500));
    return onSnapshot(
      ref,
      (snapshot) => onData(snapshot.docs.map((d) => parseRequest(d.id, d.data())).filter((r): r is DayOffRequest => r !== null)),
      onError,
    );
  },

  /**
   * APPROVE: add the request to the SNV2 roster as Req off — the same change
   * SNV2 makes when the manager adds it by hand. Returns what was applied and
   * what was skipped (locked / past / already taken).
   */
  async approveIntoRoster(rnId: string, dates: string[], reason: string) {
    const uid = snv2Auth().currentUser?.uid;
    if (!uid) throw new RosterError('snv2/no-roster', 'Connect SNV2 first.');
    return updateRoster(snv2Db(), uid, (state) => applyReqOff(state, { rnId, dates, reason, today: todayIso() }));
  },

  /** UNDO an approval: remove only the Req off days PACU Hub added and that are unchanged. */
  async removeFromRoster(rnId: string, applied: string[], notesWritten: string[], reason: string) {
    const uid = snv2Auth().currentUser?.uid;
    if (!uid) throw new RosterError('snv2/no-roster', 'Connect SNV2 first.');
    return updateRoster(snv2Db(), uid, (state) => removeReqOff(state, { rnId, applied, notesWritten, reason }));
  },

  /**
   * Live view of the connected manager's SNV2 roster state (read only), used
   * to publish locked fortnights. `exists: false` when there is no roster yet.
   */
  watchRoster(onData: (roster: { exists: boolean; state: unknown }) => void, onError: (error: unknown) => void): () => void {
    const uid = snv2Auth().currentUser?.uid;
    if (!uid) {
      onError(new RosterError('snv2/no-roster', 'Connect SNV2 first.'));
      return () => {};
    }
    return onSnapshot(
      doc(snv2Db(), 'rosters', uid),
      (snap) => onData({ exists: snap.exists(), state: snap.exists() ? (snap.data() as { state?: unknown }).state : undefined }),
      onError,
    );
  },

  /** Mark a request handled / not handled (the only field SNV2 lets the owner change). */
  async setDone(formId: string, requestId: string, done: boolean): Promise<void> {
    await updateDoc(doc(snv2Db(), 'requestForms', formId, 'requests', requestId), { done });
  },
};

export function friendlySnv2Error(error: unknown): string {
  const code = (error as { code?: string }).code;
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'SNV2 email or password is incorrect.';
  }
  if (code === 'auth/network-request-failed') return 'No connection to SNV2. Check the network and try again.';
  if (code === 'permission-denied') return "This SNV2 account doesn't own the request form or roster.";
  if (code === 'snv2/no-roster') return (error as Error).message;
  if (code === 'snv2/bad-roster') return 'The SNV2 roster could not be read. Open SNV2 once, then try again.';
  return 'Could not reach SNV2. Please try again.';
}
