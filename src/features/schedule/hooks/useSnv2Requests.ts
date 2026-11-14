/**
 * Day-off request workflow for the Schedule tab:
 *   SNV2 connection (manager sign-in) · live requests · PACU Hub decisions ·
 *   approve (→ Req off in the SNV2 roster) · reject · undo.
 *
 * Order of operations is chosen so a failure never leaves a silent mismatch:
 *   approve: roster write → decision record (rolled back from the roster if the
 *            record can't be saved) → mark the SNV2 request done (best effort).
 *   undo:    roster removal → delete decision → reopen the SNV2 request.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { deleteDecision, saveDecision, watchDecisions, type DayOffDecision } from '@/services/schedule/dayOffDecisions';
import { logActivity } from '@/services/activity/activityLog';
import { logger } from '@/services/monitoring/logger';
import { friendlySnv2Error, isSnv2Configured, snv2Requests, type DayOffRequest, type Snv2Manager } from '@/services/snv2/requestsService';

export interface ApproveOutcome {
  applied: string[];
  skipped: { date: string; why: string }[];
}

export interface UndoOutcome {
  /** Days that could not be removed because their fortnight is now locked. */
  locked: string[];
  /** Days changed in SNV2 since approval — left as they are. */
  changedInSnv2: string[];
}

export function useSnv2Requests(formId: string | null) {
  const configured = isSnv2Configured();
  const { state } = useAuth();
  const hubUid = state.status === 'authorized' ? state.user.uid : '';
  const hubName = state.status === 'authorized' ? state.user.displayName || state.user.email || 'Unknown' : '';
  const log = useCallback((summary: string) => void logActivity('dayoff', summary, { uid: hubUid, name: hubName }), [hubUid, hubName]);

  const [manager, setManager] = useState<Snv2Manager | null>(null);
  const [initializing, setInitializing] = useState(configured);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [requests, setRequests] = useState<DayOffRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<DayOffDecision[]>([]);

  useEffect(() => {
    if (!configured) return;
    return snv2Requests.watchSession((next) => {
      setInitializing(false);
      setManager(next);
    });
  }, [configured]);

  useEffect(() => {
    if (!manager || !formId) {
      setRequests([]);
      return;
    }
    setLoadingRequests(true);
    setRequestsError(null);
    return snv2Requests.watchRequests(
      formId,
      (next) => {
        setRequests(next);
        setLoadingRequests(false);
      },
      (error) => {
        setRequestsError(friendlySnv2Error(error));
        setLoadingRequests(false);
      },
    );
  }, [manager, formId]);

  useEffect(() => {
    if (!formId) {
      setDecisions([]);
      return;
    }
    return watchDecisions(formId, setDecisions, (error) => logger.warn('Decisions unavailable', { error: String(error) }));
  }, [formId]);

  const decisionByRequest = useMemo(() => new Map(decisions.map((d) => [d.requestId, d])), [decisions]);
  const pending = useMemo(() => requests.filter((r) => !decisionByRequest.has(r.id) && !r.done), [requests, decisionByRequest]);
  /** Done in SNV2 directly, with no PACU Hub decision. */
  const handledElsewhere = useMemo(() => requests.filter((r) => !decisionByRequest.has(r.id) && r.done), [requests, decisionByRequest]);

  const connect = useCallback(async (email: string, password: string) => {
    setConnecting(true);
    setConnectError(null);
    try {
      await snv2Requests.signIn(email, password);
    } catch (error) {
      setConnectError(friendlySnv2Error(error));
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => snv2Requests.signOut(), []);

  const markDone = useCallback(
    async (requestId: string, done: boolean) => {
      if (!formId) return;
      try {
        await snv2Requests.setDone(formId, requestId, done);
      } catch (error) {
        logger.warn('Could not update SNV2 request status', { code: (error as { code?: string }).code });
      }
    },
    [formId],
  );

  const approve = useCallback(
    async (request: DayOffRequest): Promise<ApproveOutcome> => {
      if (!formId) throw new Error('No request form.');
      let result;
      try {
        result = await snv2Requests.approveIntoRoster(request.rnId, request.dates, request.reason);
      } catch (error) {
        throw new Error(friendlySnv2Error(error));
      }
      if (!result.applied.length) {
        const why = result.skipped.map((s) => `${s.date}: ${s.why}`).join('; ');
        throw new Error(`Nothing was added to the roster — ${why || 'no valid dates'}.`);
      }
      try {
        await saveDecision(
          {
            formId,
            requestId: request.id,
            rnId: request.rnId,
            name: request.name,
            dates: request.dates,
            reason: request.reason,
            decision: 'approved',
            applied: result.applied,
            notesWritten: result.notesWritten,
            skipped: result.skipped,
          },
          hubUid,
        );
      } catch (error) {
        // Keep roster and history consistent: undo the roster change.
        await snv2Requests
          .removeFromRoster(request.rnId, result.applied, result.notesWritten, request.reason)
          .catch((e) => logger.error('Rollback after failed decision save', e));
        throw new Error('Could not save the decision, so the roster change was reverted. Please try again.', { cause: error });
      }
      await markDone(request.id, true);
      log(`Approved day off for ${request.name}: ${result.applied.join(', ')} added as Req off${result.skipped.length ? ` (${result.skipped.length} day(s) skipped)` : ''}`);
      return { applied: result.applied, skipped: result.skipped };
    },
    [formId, hubUid, markDone, log],
  );

  const reject = useCallback(
    async (request: DayOffRequest): Promise<void> => {
      if (!formId) throw new Error('No request form.');
      await saveDecision(
        {
          formId,
          requestId: request.id,
          rnId: request.rnId,
          name: request.name,
          dates: request.dates,
          reason: request.reason,
          decision: 'rejected',
          applied: [],
          notesWritten: [],
          skipped: [],
        },
        hubUid,
      );
      await markDone(request.id, true);
      log(`Rejected day-off request from ${request.name}: ${request.dates.join(', ')}`);
    },
    [formId, hubUid, markDone, log],
  );

  const undo = useCallback(
    async (decision: DayOffDecision): Promise<UndoOutcome> => {
      let locked: string[] = [];
      let changedInSnv2: string[] = [];
      if (decision.decision === 'approved' && decision.applied.length) {
        let r;
        try {
          r = await snv2Requests.removeFromRoster(decision.rnId, decision.applied, decision.notesWritten, decision.reason);
        } catch (error) {
          throw new Error(friendlySnv2Error(error));
        }
        locked = r.locked;
        changedInSnv2 = r.changedInSnv2;
        if (locked.length) {
          // Some days are now in a locked fortnight: keep them on record as applied.
          await saveDecision(
            { ...decision, applied: locked, notesWritten: decision.notesWritten.filter((d) => locked.includes(d)) },
            hubUid,
          );
          return { locked, changedInSnv2 };
        }
      }
      await deleteDecision(decision.formId, decision.requestId);
      await markDone(decision.requestId, false);
      log(`Undid ${decision.decision === 'approved' ? 'approval' : 'rejection'} for ${decision.name}: ${decision.dates.join(', ')}`);
      return { locked, changedInSnv2 };
    },
    [hubUid, markDone, log],
  );

  return {
    configured,
    manager,
    initializing,
    connecting,
    connectError,
    requests,
    pending,
    handledElsewhere,
    decisions,
    loadingRequests,
    requestsError,
    connect,
    disconnect,
    approve,
    reject,
    undo,
    reopen: (requestId: string) => markDone(requestId, false),
  };
}
