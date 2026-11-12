/**
 * Schedule settings (`pacuhub_settings/schedule`). Read by anyone with
 * Schedule access; written only by "Manage schedule" (enforced by rules).
 */
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firestore } from '@/services/firebase/client';
import { COLLECTIONS } from '@/services/firestore/collections';
import { normalizeRequestLink } from './requestLink';

export interface ScheduleSettings {
  requestLink: string | null;
}

const ref = () => doc(firestore(), COLLECTIONS.settings, 'schedule');

export async function getScheduleSettings(): Promise<ScheduleSettings> {
  const snapshot = await getDoc(ref());
  const raw = snapshot.exists() ? snapshot.get('requestLink') : null;
  // Re-validate on read: a malformed value is treated as "not set".
  return { requestLink: typeof raw === 'string' ? normalizeRequestLink(raw) : null };
}

export async function saveRequestLink(link: string | null, editorUid: string): Promise<void> {
  const value = link === null ? null : normalizeRequestLink(link);
  if (link !== null && value === null) throw new Error('INVALID_LINK');
  await setDoc(ref(), { requestLink: value, updatedAt: serverTimestamp(), updatedBy: editorUid });
}
