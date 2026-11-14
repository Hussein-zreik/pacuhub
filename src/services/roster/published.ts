/**
 * Published roster — pure logic (no Firebase).
 *
 * In SNV2, LOCKING a fortnight saves a fixed copy of it in
 *   state.lockedCycles[cycleMonday] = {
 *     at, rns: [{id, name, g, row: [14 shifts]}],
 *     staff: [{id, g, name}], staffShifts: {date: {staffId: shift}},
 *     flags, notes,
 *   }
 * PACU Hub treats "locked" as "published": every locked fortnight in a recent
 * window is copied to pacuhub_rosters/{cycleMonday} for staff to view.
 *
 * PRIVACY: day comments (`notes`) and `flags` are NEVER copied — comments can
 * hold day-off reasons. Only names and shift codes leave SNV2.
 */

export const DAYS_PER_CYCLE = 14;
/** Fortnights that ended more than this many days ago are no longer published. */
export const KEEP_PAST_DAYS = 28;
const MAX_RNS = 120;
const MAX_GROUP_ROWS = 40;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const CODE = /^[A-Za-z0-9]{1,4}$/;

export interface RosterRow {
  id: string;
  name: string;
  /** 14 shift codes, Monday to Sunday twice. 'OFF' = day off. */
  row: string[];
}

export interface RosterGroup {
  label: string;
  rows: RosterRow[];
}

export interface CustomShift {
  code: string;
  label: string;
  color: string;
}

export interface PublishedRoster {
  /** The fortnight's Monday, YYYY-MM-DD (also the document id). */
  start: string;
  /** When it was locked in SNV2 (ISO string from SNV2). */
  lockedAt: string;
  rns: RosterRow[];
  /** Support staff (Nurse Aids, Orderlies, Clerks…), under the RNs. */
  groups: RosterGroup[];
  /** SNV2 custom shift types (code, label, colour) used for the legend. */
  shifts: CustomShift[];
}

export interface StoredRoster extends PublishedRoster {
  fp: string;
  syncedAt: Date | null;
}

// SNV2's built-in shift types (index.html CORE_LABELS) and its default
// support-staff group names (STAFF_GROUPS).
export const CORE_SHIFTS: Record<string, { label: string; kind: 'day' | 'evening' | 'night' | 'leave' | 'off' }> = {
  D6: { label: '6am', kind: 'day' },
  D7: { label: '7am', kind: 'day' },
  S8: { label: '8am', kind: 'evening' },
  S9: { label: '9am', kind: 'evening' },
  S10: { label: '10am', kind: 'evening' },
  N7: { label: 'Night', kind: 'night' },
  HOL: { label: 'Holiday', kind: 'leave' },
  VAC: { label: 'Vacation', kind: 'leave' },
  SL: { label: 'Sick leave', kind: 'leave' },
  REQ: { label: 'Requested off', kind: 'off' },
  OFF: { label: 'Day off', kind: 'off' },
};
const STAFF_GROUPS: { key: string; label: string }[] = [
  { key: 'AIDE', label: 'Nurse Aids' },
  { key: 'ORD', label: 'Orderlies' },
  { key: 'CLK', label: 'Clerks' },
];

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const code = (v: unknown) => (typeof v === 'string' && CODE.test(v) ? v : 'OFF');

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const cycleDays = (start: string): string[] => Array.from({ length: DAYS_PER_CYCLE }, (_, i) => addDaysIso(start, i));
export const cycleEnd = (start: string): string => addDaysIso(start, DAYS_PER_CYCLE - 1);

function cleanRow(raw: unknown): string[] {
  const row = Array.isArray(raw) ? raw : [];
  return Array.from({ length: DAYS_PER_CYCLE }, (_, i) => code(row[i]));
}

function cleanCustomShifts(raw: unknown): CustomShift[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => isObj(s) && typeof s.code === 'string' && CODE.test(s.code) && !(s.code in CORE_SHIFTS))
    .slice(0, 20)
    .map((s) => ({
      code: s.code as string,
      label: str(s.label, 24) || (s.code as string),
      color: typeof s.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(s.color) ? s.color : '#8f9cf0',
    }));
}

/** One locked SNV2 fortnight → what staff may see. Returns null if unreadable. */
export function toPublished(start: string, lock: unknown, state: Record<string, unknown>): PublishedRoster | null {
  if (!ISO.test(start) || !isObj(lock) || !Array.isArray(lock.rns)) return null;

  const rns: RosterRow[] = lock.rns
    .filter(isObj)
    .slice(0, MAX_RNS)
    .map((r) => ({ id: str(r.id, 40), name: str(r.name, 80) || 'RN', row: cleanRow(r.row) }))
    .filter((r) => r.id);

  const days = cycleDays(start);
  const staffShifts = isObj(lock.staffShifts) ? lock.staffShifts : {};
  const staff = Array.isArray(lock.staff) ? lock.staff.filter(isObj) : [];
  const labels = isObj(state.staffLabels) ? state.staffLabels : {};
  const groups: RosterGroup[] = STAFF_GROUPS.map(({ key, label }) => ({
    label: str(labels[key], 40) || label,
    rows: staff
      .filter((p) => p.g === key)
      .slice(0, MAX_GROUP_ROWS)
      .map((p) => {
        const id = str(p.id, 40);
        return {
          id,
          name: str(p.name, 80) || label,
          row: days.map((d) => {
            const day = staffShifts[d];
            return code(isObj(day) ? day[id] : undefined);
          }),
        };
      })
      .filter((p) => p.id),
  })).filter((g) => g.rows.length > 0);

  return { start, lockedAt: str(lock.at, 40), rns, groups, shifts: cleanCustomShifts(state.customShifts) };
}

/** Every locked fortnight still worth showing (ended ≤ KEEP_PAST_DAYS ago, or later). */
export function extractPublished(state: unknown, today: string): Map<string, PublishedRoster> {
  const out = new Map<string, PublishedRoster>();
  if (!isObj(state) || !isObj(state.lockedCycles)) return out;
  const oldestEnd = addDaysIso(today, -KEEP_PAST_DAYS);
  for (const [start, lock] of Object.entries(state.lockedCycles)) {
    if (!ISO.test(start) || cycleEnd(start) < oldestEnd) continue;
    const roster = toPublished(start, lock, state);
    if (roster) out.set(start, roster);
  }
  return out;
}

/** Short content fingerprint (FNV-1a), so unchanged fortnights aren't rewritten. */
export function fingerprint(r: PublishedRoster): string {
  const text = JSON.stringify([r.start, r.lockedAt, r.rns, r.groups, r.shifts]);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export interface SyncPlan {
  write: PublishedRoster[];
  remove: string[];
}

/** Mirror: publish new/changed locked fortnights, remove ones no longer locked (or too old). */
export function planSync(wanted: Map<string, PublishedRoster>, existing: readonly { start: string; fp: string }[]): SyncPlan {
  const have = new Map(existing.map((e) => [e.start, e.fp]));
  return {
    write: [...wanted.values()].filter((r) => have.get(r.start) !== fingerprint(r)),
    remove: [...have.keys()].filter((start) => !wanted.has(start)),
  };
}

/** The fortnight to open first: the one containing today, else the next one, else the latest. */
export function defaultRosterIndex(rosters: readonly { start: string }[], today: string): number {
  if (!rosters.length) return -1;
  const current = rosters.findIndex((r) => r.start <= today && today <= cycleEnd(r.start));
  if (current >= 0) return current;
  const next = rosters.findIndex((r) => r.start > today);
  return next >= 0 ? next : rosters.length - 1;
}

/** A person's row in a published fortnight (RN or support staff), or null. */
export function findRow(roster: PublishedRoster, rosterId: string | null): RosterRow | null {
  if (!rosterId) return null;
  return roster.rns.find((r) => r.id === rosterId) ?? roster.groups.flatMap((g) => g.rows).find((r) => r.id === rosterId) ?? null;
}

export function shiftLabel(c: string, custom: readonly CustomShift[]): string {
  return CORE_SHIFTS[c]?.label ?? custom.find((s) => s.code === c)?.label ?? c;
}

export const isWorking = (c: string): boolean => {
  const kind = CORE_SHIFTS[c]?.kind;
  return kind === undefined ? c !== 'OFF' : kind === 'day' || kind === 'evening' || kind === 'night';
};

/** Everyone who appears in the given fortnights, for linking accounts to roster names. */
export function rosterPeople(rosters: readonly PublishedRoster[]): { id: string; name: string; group: string }[] {
  const seen = new Map<string, { id: string; name: string; group: string }>();
  for (const r of [...rosters].sort((a, b) => b.start.localeCompare(a.start))) {
    for (const p of r.rns) if (!seen.has(p.id)) seen.set(p.id, { id: p.id, name: p.name, group: 'RNs' });
    for (const g of r.groups) for (const p of g.rows) if (!seen.has(p.id)) seen.set(p.id, { id: p.id, name: p.name, group: g.label });
  }
  return [...seen.values()];
}
