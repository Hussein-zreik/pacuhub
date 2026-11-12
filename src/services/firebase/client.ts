/**
 * Firebase client singleton.
 *
 * Initialized lazily on first use so that (a) the app can render a setup
 * screen when config is missing, and (b) unit tests never touch Firebase.
 *
 * Firestore uses the default in-memory cache on purpose: PACU workstations
 * are shared, and a persistent (IndexedDB) cache could leave clinical data
 * on disk after a nurse signs out.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { env } from '@/config/env';

export class FirebaseNotConfiguredError extends Error {
  constructor() {
    super('Firebase is not configured. See .env.example.');
    this.name = 'FirebaseNotConfiguredError';
  }
}

let app: FirebaseApp | null = null;

function firebaseApp(): FirebaseApp {
  if (app) return app;
  if (!env.firebase) throw new FirebaseNotConfiguredError();
  app = getApps().length ? getApp() : initializeApp(env.firebase);
  return app;
}

export const firebaseAuth = (): Auth => getAuth(firebaseApp());
export const firestore = (): Firestore => getFirestore(firebaseApp());
