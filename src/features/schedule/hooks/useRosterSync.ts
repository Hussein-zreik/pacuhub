/**
 * Automatic publishing (schedule managers): while SNV2 is connected, every
 * fortnight LOCKED in SNV2 is mirrored to PACU Hub for staff to view, and
 * unlocked ones are removed. Runs live — lock in SNV2 and it appears here.
 *
 * Writes only when something actually changed (content fingerprint), so an
 * open tab doesn't keep rewriting the same data.
 */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { logActivity } from '@/services/activity/activityLog';
import { logger } from '@/services/monitoring/logger';
import { extractPublished, planSync, type StoredRoster } from '@/services/roster/published';
import { applySyncPlan } from '@/services/roster/publishedRosters';
import { isSnv2Configured, snv2Requests, type Snv2Manager } from '@/services/snv2/requestsService';
import { todayIso } from '@/utils/format';

export type SyncStatus =
  | { kind: 'not-configured' }
  | { kind: 'not-connected' }
  | { kind: 'waiting' }
  | { kind: 'no-roster' }
  | { kind: 'synced'; checkedAt: Date }
  | { kind: 'error'; message: string };

const fmtRange = (starts: string[]) => starts.map((s) => new Date(`${s}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })).join(', ');

export function useRosterSync(published: StoredRoster[] | null): SyncStatus {
  const configured = isSnv2Configured();
  const { state } = useAuth();
  const me = state.status === 'authorized' ? { uid: state.user.uid, name: state.user.displayName || state.user.email || 'Unknown' } : null;
  const meRef = useRef(me);
  meRef.current = me;

  const [manager, setManager] = useState<Snv2Manager | null | undefined>(undefined);
  const [snv2, setSnv2] = useState<{ exists: boolean; state: unknown } | null>(null);
  const [status, setStatus] = useState<SyncStatus>(configured ? { kind: 'waiting' } : { kind: 'not-configured' });
  const busy = useRef(false);

  useEffect(() => (configured ? snv2Requests.watchSession(setManager) : undefined), [configured]);

  useEffect(() => {
    setSnv2(null);
    if (!manager) return;
    return snv2Requests.watchRoster(setSnv2, (e) => {
      logger.warn('SNV2 roster unavailable', { error: String(e) });
      setStatus({ kind: 'error', message: "Couldn't read the SNV2 roster. Check the connection, or reconnect SNV2." });
    });
  }, [manager]);

  useEffect(() => {
    if (!configured) return;
    if (manager === null) return setStatus({ kind: 'not-connected' });
    if (!manager || !snv2 || !published) return;
    // Safety: no roster document at all (e.g. a different SNV2 login) → change nothing.
    if (!snv2.exists) return setStatus({ kind: 'no-roster' });
    const plan = planSync(extractPublished(snv2.state, todayIso()), published);
    if (!plan.write.length && !plan.remove.length) return setStatus({ kind: 'synced', checkedAt: new Date() });
    if (busy.current || !meRef.current) return;
    busy.current = true;
    const actor = meRef.current;
    applySyncPlan(plan, actor.uid)
      .then(() => {
        setStatus({ kind: 'synced', checkedAt: new Date() });
        const parts = [
          plan.write.length ? `published ${fmtRange(plan.write.map((r) => r.start))}` : '',
          plan.remove.length ? `removed ${fmtRange(plan.remove)}` : '',
        ].filter(Boolean);
        void logActivity('schedule', `Roster sync from SNV2: ${parts.join('; ')}`, actor);
      })
      .catch((e: unknown) => {
        logger.warn('Roster sync failed', { code: (e as { code?: string }).code });
        setStatus({
          kind: 'error',
          message:
            (e as { code?: string }).code === 'permission-denied'
              ? 'PACU Hub refused the update. Make sure the latest security rules are published.'
              : "Couldn't publish to PACU Hub. It will retry when the roster changes or you reload.",
        });
      })
      .finally(() => {
        busy.current = false;
      });
  }, [configured, manager, snv2, published]);

  return status;
}
