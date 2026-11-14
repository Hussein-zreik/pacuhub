/**
 * Pure roster logic — a faithful mirror of what SNV2 itself does when the
 * manager adds or deletes a "Req off" by hand (SNV2 index.html `reqAdd` /
 * `reqDelete`), so an approval from PACU Hub has EXACTLY the same effect.
 *
 *   SNV2 roster state (rosters/{managerUid}.state) keeps requests as
 *     overrides[YYYY-MM-DD][nurseId] = 'REQ'      (Req off)
 *     notes[YYYY-MM-DD][nurseId]     = reason     (that day's comment)
 *   and published fortnights in lockedCycles[cycleMonday] — "nothing reaches a
 *   locked fortnight".
 *
 * Safety rules (stricter than SNV2's manual flow, on purpose):
 *   - never touch a locked fortnight, never write a past date;
 *   - never overwrite anything the nurse already has that day;
 *   - never overwrite an existing comment;
 *   - undo removes only what PACU Hub added and that is still unchanged.
 *
 * No imports: this file is shared with the emulator tests and must stay pure.
 */

export type RosterState = Record<string, unknown>;
type DayMap = Record<string, Record<string, unknown>>;

export const REQ_OFF = 'REQ';
const NOTE_MAX = 300; // SNV2 cleanNotes: trim().slice(0, 300)
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export interface Skip {
  date: string;
  why: string;
}

export interface ApplyResult {
  state: RosterState;
  changed: boolean;
  /** Dates written as Req off by this approval (what Undo may remove). */
  applied: string[];
  /** Dates where the reason was written as the day's comment. */
  notesWritten: string[];
  skipped: Skip[];
}

export interface RemoveResult {
  state: RosterState;
  changed: boolean;
  removed: string[];
  /** Still Req off, but now inside a locked fortnight — cannot be undone. */
  locked: string[];
  /** No longer PACU Hub's Req off (changed in SNV2) — left exactly as is. */
  changedInSnv2: string[];
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const noteOf = (reason: string) => String(reason || '').trim().slice(0, NOTE_MAX);

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Local calendar day as YYYY-MM-DD (SNV2 works in local days, never UTC). */
export function todayIso(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** A date is locked when it falls in a locked fortnight: [cycleMonday, +13 days]. */
export function isDateLocked(lockedCycles: unknown, iso: string): boolean {
  if (!isObj(lockedCycles)) return false;
  return Object.keys(lockedCycles).some((start) => ISO.test(start) && iso >= start && iso <= addDaysIso(start, 13));
}

export function applyReqOff(
  state: RosterState,
  input: { rnId: string; dates: string[]; reason: string; today: string },
): ApplyResult {
  const { rnId, reason, today } = input;
  const dates = [...new Set(input.dates)].sort();
  const ids = Array.isArray(state.ids) ? state.ids.map(String) : [];
  if (!ids.includes(rnId)) {
    return { state, changed: false, applied: [], notesWritten: [], skipped: dates.map((date) => ({ date, why: 'not on the SNV2 roster' })) };
  }

  const next = clone(state);
  const overrides: DayMap = isObj(next.overrides) ? (next.overrides as DayMap) : {};
  const notes: DayMap = isObj(next.notes) ? (next.notes as DayMap) : {};
  const note = noteOf(reason);
  const applied: string[] = [];
  const notesWritten: string[] = [];
  const skipped: Skip[] = [];

  for (const date of dates) {
    if (!ISO.test(date)) { skipped.push({ date, why: 'invalid date' }); continue; }
    if (date < today) { skipped.push({ date, why: 'date has passed' }); continue; }
    if (isDateLocked(next.lockedCycles, date)) { skipped.push({ date, why: 'fortnight is locked in SNV2' }); continue; }
    const day = isObj(overrides[date]) ? overrides[date] : undefined;
    const existing = day?.[rnId];
    if (existing === REQ_OFF) { skipped.push({ date, why: 'already Req off in SNV2' }); continue; }
    if (existing !== undefined) { skipped.push({ date, why: `already has "${String(existing)}" that day` }); continue; }

    overrides[date] = { ...(day ?? {}), [rnId]: REQ_OFF };
    applied.push(date);
    if (note) {
      const noteDay = isObj(notes[date]) ? notes[date] : undefined;
      if (noteDay?.[rnId] === undefined) {
        notes[date] = { ...(noteDay ?? {}), [rnId]: note };
        notesWritten.push(date);
      }
    }
  }

  if (!applied.length) return { state, changed: false, applied, notesWritten, skipped };
  next.overrides = overrides;
  if (notesWritten.length) next.notes = notes;
  return { state: next, changed: true, applied, notesWritten, skipped };
}

export function removeReqOff(
  state: RosterState,
  input: { rnId: string; applied: string[]; notesWritten: string[]; reason: string },
): RemoveResult {
  const { rnId } = input;
  const next = clone(state);
  const overrides: DayMap = isObj(next.overrides) ? (next.overrides as DayMap) : {};
  const notes: DayMap = isObj(next.notes) ? (next.notes as DayMap) : {};
  const note = noteOf(input.reason);
  const removed: string[] = [];
  const locked: string[] = [];
  const changedInSnv2: string[] = [];

  const drop = (map: DayMap, date: string) => {
    const rest = { ...(map[date] ?? {}) };
    delete rest[rnId];
    if (Object.keys(rest).length) map[date] = rest;
    else delete map[date];
  };

  for (const date of [...new Set(input.applied)]) {
    const day = overrides[date];
    if (!isObj(day) || day[rnId] !== REQ_OFF) { changedInSnv2.push(date); continue; }
    if (isDateLocked(next.lockedCycles, date)) { locked.push(date); continue; }
    drop(overrides, date);
    removed.push(date);
    // Remove our comment only for days we actually reverted, and only if it's
    // still the exact text we wrote (the manager may have edited it).
    if (input.notesWritten.includes(date) && isObj(notes[date]) && notes[date][rnId] === note) drop(notes, date);
  }

  if (!removed.length) return { state, changed: false, removed, locked, changedInSnv2 };
  next.overrides = overrides;
  next.notes = notes;
  return { state: next, changed: true, removed, locked, changedInSnv2 };
}
