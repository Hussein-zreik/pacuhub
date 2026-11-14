/**
 * Live bay board — pure logic (no Firebase).
 *
 * Status names follow Epic's PACU snapboard so nurses use the same words:
 *   Empty → In Recovery → Recovery Care Complete → Out of Recovery (bay empty)
 * plus Closed (bay out of service; managers only).
 *
 * NO PATIENT DATA, by design: a bay holds only its status, the assigned
 * nurse, fixed quick tags, a fixed delay reason and timestamps. There is no
 * free-text field anywhere a patient detail could be typed.
 */

export const BAY_STATUSES = ['empty', 'in-recovery', 'care-complete', 'closed'] as const;
export type BayStatus = (typeof BAY_STATUSES)[number];

export const STATUS_LABEL: Record<BayStatus, string> = {
  empty: 'Empty',
  'in-recovery': 'In Recovery',
  'care-complete': 'Recovery Care Complete',
  closed: 'Closed',
};

export const DELAY_REASONS = ['awaiting-bed', 'awaiting-transport', 'awaiting-physician', 'other'] as const;
export type DelayReason = (typeof DELAY_REASONS)[number];
export const DELAY_LABEL: Record<DelayReason, string> = {
  'awaiting-bed': 'Awaiting bed',
  'awaiting-transport': 'Awaiting transport',
  'awaiting-physician': 'Awaiting physician',
  other: 'Other delay',
};

export const BAY_TAGS = ['isolation', 'pediatric', 'oxygen', 'fall-risk'] as const;
export type BayTag = (typeof BAY_TAGS)[number];
export const TAG_LABEL: Record<BayTag, string> = {
  isolation: 'Isolation',
  pediatric: 'Pediatric',
  oxygen: 'On O2',
  'fall-risk': 'Fall risk',
};

export const CAPACITY_LEVELS = ['green', 'amber', 'red'] as const;
export type CapacityLevel = (typeof CAPACITY_LEVELS)[number];
export const CAPACITY_LABEL: Record<CapacityLevel, string> = {
  green: 'Accepting patients',
  amber: 'Busy — call before sending',
  red: 'Full — hold transfers',
};

export const BAY_NAME_MAX = 24;
export const MINUTES_MIN = 5;
export const MINUTES_MAX = 600;

export interface Nurse {
  uid: string | null;
  name: string;
}

export interface Bay {
  id: string;
  name: string;
  order: number;
  status: BayStatus;
  nurse: Nurse | null;
  tags: BayTag[];
  delayReason: DelayReason | null;
  inRecoveryAt: Date | null;
  careCompleteAt: Date | null;
  updatedAt: Date | null;
  updatedByName: string | null;
}

export interface Threshold {
  amber: number;
  red: number;
}

export interface BoardConfig {
  /** Minutes in recovery before the bay turns amber / red. */
  recovery: Threshold;
  /** Minutes waiting after Recovery Care Complete before amber / red. */
  complete: Threshold;
  capacity: { level: CapacityLevel; note: string };
}

export const DEFAULT_CONFIG: BoardConfig = {
  recovery: { amber: 60, red: 120 },
  complete: { amber: 30, red: 60 },
  capacity: { level: 'green', note: '' },
};

// ── Actions ────────────────────────────────────────────────────────────────

export type BayAction =
  | { type: 'place'; nurse: Nurse | null; tags: BayTag[] }
  | { type: 'complete' }
  | { type: 'back-to-recovery' }
  | { type: 'out' }
  | { type: 'edit'; nurse: Nurse | null; tags: BayTag[]; delayReason: DelayReason | null }
  | { type: 'close' }
  | { type: 'open' };

/** "now" = set to server time; a Date = keep as is; null = clear. */
export type Stamp = 'now' | Date | null;

export interface BayPatch {
  status: BayStatus;
  nurse: Nurse | null;
  tags: BayTag[];
  delayReason: DelayReason | null;
  inRecoveryAt: Stamp;
  careCompleteAt: Stamp;
}

export interface BayEventDraft {
  action: 'in' | 'complete' | 'out';
  delayReason: DelayReason | null;
  /** Whole minutes in recovery (In Recovery → Out). */
  recoveryMin: number | null;
  /** Whole minutes waiting after Care Complete (Care Complete → Out). */
  waitMin: number | null;
}

export class BayActionError extends Error {}

const EMPTY_PATCH: BayPatch = { status: 'empty', nurse: null, tags: [], delayReason: null, inRecoveryAt: null, careCompleteAt: null };

export const minutesBetween = (from: Date | null, to: Date): number | null =>
  from ? Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60000)) : null;

const cleanTags = (tags: readonly string[]): BayTag[] => BAY_TAGS.filter((t) => tags.includes(t));
const cleanNurse = (n: Nurse | null): Nurse | null => (n && n.name.trim() ? { uid: n.uid, name: n.name.trim().slice(0, 80) } : null);

/** Which actions make sense for a bay right now (managers also get close/open). */
export function availableActions(bay: Pick<Bay, 'status'>, canManage: boolean): BayAction['type'][] {
  switch (bay.status) {
    case 'empty':
      return canManage ? ['place', 'close'] : ['place'];
    case 'in-recovery':
      return ['complete', 'out', 'edit'];
    case 'care-complete':
      return ['out', 'back-to-recovery', 'edit'];
    case 'closed':
      return canManage ? ['open'] : [];
  }
}

/**
 * Apply an action: the new bay fields plus, for the flow steps, an event for
 * today's statistics. Throws BayActionError for a step that doesn't fit the
 * bay's current status (e.g. someone else just changed it).
 */
export function applyAction(bay: Bay, action: BayAction, now: Date): { patch: BayPatch; event: BayEventDraft | null } {
  const keep = (d: Date | null): Stamp => d;
  const wrong = () => new BayActionError(`${bay.name} is now ${STATUS_LABEL[bay.status]}. Check the board and try again.`);

  switch (action.type) {
    case 'place':
      if (bay.status !== 'empty') throw wrong();
      return {
        patch: { status: 'in-recovery', nurse: cleanNurse(action.nurse), tags: cleanTags(action.tags), delayReason: null, inRecoveryAt: 'now', careCompleteAt: null },
        event: { action: 'in', delayReason: null, recoveryMin: null, waitMin: null },
      };
    case 'complete':
      if (bay.status !== 'in-recovery') throw wrong();
      return {
        patch: { status: 'care-complete', nurse: bay.nurse, tags: bay.tags, delayReason: null, inRecoveryAt: keep(bay.inRecoveryAt), careCompleteAt: 'now' },
        event: { action: 'complete', delayReason: null, recoveryMin: minutesBetween(bay.inRecoveryAt, now), waitMin: null },
      };
    case 'back-to-recovery':
      if (bay.status !== 'care-complete') throw wrong();
      return {
        patch: { status: 'in-recovery', nurse: bay.nurse, tags: bay.tags, delayReason: null, inRecoveryAt: keep(bay.inRecoveryAt), careCompleteAt: null },
        event: null,
      };
    case 'out':
      if (bay.status !== 'in-recovery' && bay.status !== 'care-complete') throw wrong();
      return {
        patch: EMPTY_PATCH,
        event: {
          action: 'out',
          delayReason: bay.delayReason,
          recoveryMin: minutesBetween(bay.inRecoveryAt, bay.careCompleteAt ?? now),
          waitMin: bay.status === 'care-complete' ? minutesBetween(bay.careCompleteAt, now) : null,
        },
      };
    case 'edit':
      if (bay.status !== 'in-recovery' && bay.status !== 'care-complete') throw wrong();
      return {
        patch: {
          status: bay.status,
          nurse: cleanNurse(action.nurse),
          tags: cleanTags(action.tags),
          delayReason: bay.status === 'care-complete' ? action.delayReason : null,
          inRecoveryAt: keep(bay.inRecoveryAt),
          careCompleteAt: keep(bay.careCompleteAt),
        },
        event: null,
      };
    case 'close':
      if (bay.status !== 'empty') throw wrong();
      return { patch: { ...EMPTY_PATCH, status: 'closed' }, event: null };
    case 'open':
      if (bay.status !== 'closed') throw wrong();
      return { patch: EMPTY_PATCH, event: null };
  }
}

// ── Timers & alerts ────────────────────────────────────────────────────────

export type AlertLevel = 'ok' | 'amber' | 'red';

/** The running clock for a bay: what it measures and since when. */
export function bayClock(bay: Bay): { since: Date; label: string; threshold: keyof Pick<BoardConfig, 'recovery' | 'complete'> } | null {
  if (bay.status === 'in-recovery' && bay.inRecoveryAt) return { since: bay.inRecoveryAt, label: 'in recovery', threshold: 'recovery' };
  if (bay.status === 'care-complete' && bay.careCompleteAt) return { since: bay.careCompleteAt, label: 'since care complete', threshold: 'complete' };
  return null;
}

export function alertLevel(bay: Bay, config: BoardConfig, now: Date): AlertLevel {
  const clock = bayClock(bay);
  if (!clock) return 'ok';
  const min = minutesBetween(clock.since, now) ?? 0;
  const t = config[clock.threshold];
  return min >= t.red ? 'red' : min >= t.amber ? 'amber' : 'ok';
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

export function boardCounts(bays: readonly Bay[]): Record<BayStatus, number> {
  const counts: Record<BayStatus, number> = { empty: 0, 'in-recovery': 0, 'care-complete': 0, closed: 0 };
  for (const b of bays) counts[b.status]++;
  return counts;
}

export interface BayEvent extends BayEventDraft {
  id: string;
  bayId: string;
  at: Date | null;
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/** Today's numbers from flow events (no patient data involved). */
export function todayStats(events: readonly BayEvent[]) {
  const outs = events.filter((e) => e.action === 'out');
  const delays = new Map<DelayReason, number>();
  for (const e of outs) if (e.delayReason) delays.set(e.delayReason, (delays.get(e.delayReason) ?? 0) + 1);
  return {
    admitted: events.filter((e) => e.action === 'in').length,
    outOfRecovery: outs.length,
    avgRecoveryMin: avg(outs.flatMap((e) => (e.recoveryMin !== null ? [e.recoveryMin] : []))),
    avgWaitMin: avg(outs.flatMap((e) => (e.waitMin !== null ? [e.waitMin] : []))),
    delays: [...delays.entries()].sort((a, b) => b[1] - a[1]),
  };
}

/** Validates manager-edited thresholds: whole minutes, amber before red. */
export function validThreshold(t: Threshold): boolean {
  return [t.amber, t.red].every((n) => Number.isInteger(n) && n >= MINUTES_MIN && n <= MINUTES_MAX) && t.amber < t.red;
}
