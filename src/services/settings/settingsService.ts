/**
 * Unit settings (admin-only writes) and personal preferences (owner-only).
 * Reads are live so a change applies to every open session within seconds.
 * Limits are validated here AND in firestore.rules.
 */
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { firestore } from '@/services/firebase/client';
import { COLLECTIONS } from '@/services/firestore/collections';
import {
  appSettingsSchema, parseApp, parsePrefs, parsePublic, publicSettingsSchema, userPrefsSchema,
  type AppSettings, type PublicSettings, type UserPrefs,
} from './model';

export interface Stamp {
  updatedAt: Date | null;
  updatedByName: string | null;
}

const settingsRef = (id: 'public' | 'app') => doc(firestore(), COLLECTIONS.settings, id);
const prefsRef = (uid: string) => doc(firestore(), COLLECTIONS.prefs, uid);

const stampOf = (data: Record<string, unknown> | undefined): Stamp => {
  const at = data?.updatedAt as { toDate?: () => Date } | undefined;
  return {
    updatedAt: at && typeof at.toDate === 'function' ? at.toDate() : null,
    updatedByName: typeof data?.updatedByName === 'string' ? data.updatedByName : null,
  };
};

export function watchPublicSettings(onData: (s: PublicSettings, stamp: Stamp) => void, onError: (e: unknown) => void) {
  return onSnapshot(
    settingsRef('public'),
    (snap) => onData(parsePublic(snap.data()), stampOf(snap.data({ serverTimestamps: 'estimate' }))),
    onError,
  );
}

export function watchAppSettings(onData: (s: AppSettings, stamp: Stamp) => void, onError: (e: unknown) => void) {
  return onSnapshot(
    settingsRef('app'),
    (snap) => onData(parseApp(snap.data()), stampOf(snap.data({ serverTimestamps: 'estimate' }))),
    onError,
  );
}

export async function savePublicSettings(s: PublicSettings, by: { uid: string; name: string }) {
  const valid = publicSettingsSchema.parse(s);
  await setDoc(settingsRef('public'), { ...valid, updatedAt: serverTimestamp(), updatedBy: by.uid, updatedByName: by.name.slice(0, 120) });
}

export async function saveAppSettings(s: AppSettings, by: { uid: string; name: string }) {
  const valid = appSettingsSchema.parse(s);
  await setDoc(settingsRef('app'), { ...valid, updatedAt: serverTimestamp(), updatedBy: by.uid, updatedByName: by.name.slice(0, 120) });
}

export function watchPrefs(uid: string, onData: (p: UserPrefs) => void, onError: (e: unknown) => void) {
  return onSnapshot(prefsRef(uid), (snap) => onData(parsePrefs(snap.data())), onError);
}

export async function savePrefs(uid: string, prefs: UserPrefs) {
  const valid = userPrefsSchema.parse(prefs);
  await setDoc(prefsRef(uid), { ...valid, updatedAt: serverTimestamp() });
}
