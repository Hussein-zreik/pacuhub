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
  const { name, dates, reason, done, createdAt } = result.data;
  return { id, name, dates: dates.split(',').map((d) => d.trim()).filter((d) => ISO.test(d)), reason, done, createdAt };
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
  if (code === 'permission-denied') return "This SNV2 account doesn't own the request form, so it can't read the requests.";
  return 'Could not reach SNV2. Please try again.';
}
