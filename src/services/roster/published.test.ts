import { describe, expect, it } from 'vitest';
import { defaultRosterIndex, extractPublished, findRow, fingerprint, planSync, rosterPeople, toPublished } from './published';

const row = (s: string) => s.split(' ');
const ROW_A = row('D7 D7 OFF N7 N7 OFF OFF S8 S8 S9 OFF OFF D6 REQ');
const lock = (over: object = {}) => ({
  at: '2026-11-20T10:00:00.000Z',
  rns: [
    { id: 'rn1', name: 'Lina Saad', g: 'A', row: ROW_A },
    { id: 'rn2', name: 'Omar Fares', g: 'B', row: [...ROW_A].reverse() },
  ],
  staff: [{ id: 'aide0', g: 'AIDE', name: 'Rami' }, { id: 'clk0', g: 'CLK', name: 'Dana' }],
  staffShifts: { '2026-11-30': { aide0: 'D7' }, '2026-12-01': { clk0: 'S8' } },
  flags: { '2026-11-30': { rn1: 'charge' } },
  notes: { '2026-12-03': { rn1: 'Medical appointment — private' } },
  ...over,
});
const STATE = {
  lockedCycles: { '2026-11-30': lock(), '2026-09-07': lock(), '2026-12-14': lock() },
  customShifts: [{ code: 'E10', label: '10a–6p', color: '#5fcfc4' }, { code: 'D6', label: 'dup', color: '#000000' }],
  staffLabels: { AIDE: 'Nurse Aides' },
  overrides: { '2027-01-05': { rn1: 'REQ' } },
};

describe('published roster', () => {
  it('copies locked fortnights in the window, never comments or flags', () => {
    const out = extractPublished(STATE, '2026-12-02');
    expect([...out.keys()].sort()).toEqual(['2026-11-30', '2026-12-14']); // September is too old
    const r = out.get('2026-11-30')!;
    expect(JSON.stringify(r)).not.toMatch(/Medical|charge/);
    expect(Object.keys(r).sort()).toEqual(['groups', 'lockedAt', 'rns', 'shifts', 'start']);
    expect(r.rns[0]).toEqual({ id: 'rn1', name: 'Lina Saad', row: ROW_A });
  });

  it('builds support-staff rows from their day entries, with custom group names', () => {
    const r = extractPublished(STATE, '2026-12-02').get('2026-11-30')!;
    expect(r.groups.map((g) => g.label)).toEqual(['Nurse Aides', 'Clerks']);
    expect(r.groups[0]!.rows[0]!.row.slice(0, 2)).toEqual(['D7', 'OFF']);
    expect(r.groups[1]!.rows[0]!.row.slice(0, 2)).toEqual(['OFF', 'S8']);
    expect(r.shifts).toEqual([{ code: 'E10', label: '10a–6p', color: '#5fcfc4' }]);
  });

  it('cleans malformed data instead of failing', () => {
    const r = toPublished('2026-11-30', { rns: [{ id: 'x', row: ['D7', '<script>', 5] }, { name: 'no id' }] }, {})!;
    expect(r.rns).toHaveLength(1);
    expect(r.rns[0]!.row.slice(0, 3)).toEqual(['D7', 'OFF', 'OFF']);
    expect(r.rns[0]!.row).toHaveLength(14);
    expect(toPublished('nope', lock(), {})).toBeNull();
    expect(extractPublished(null, '2026-12-02').size).toBe(0);
  });

  it('plans a mirror: new/changed written, unchanged skipped, unlocked removed', () => {
    const wanted = extractPublished(STATE, '2026-12-02');
    const a = wanted.get('2026-11-30')!;
    const plan = planSync(wanted, [
      { start: '2026-11-30', fp: fingerprint(a) },
      { start: '2026-12-14', fp: 'stale' },
      { start: '2026-11-16', fp: 'x' },
    ]);
    expect(plan.write.map((r) => r.start)).toEqual(['2026-12-14']);
    expect(plan.remove).toEqual(['2026-11-16']);
  });

  it('opens the current fortnight, else the next, else the latest', () => {
    const list = [{ start: '2026-11-16' }, { start: '2026-11-30' }, { start: '2026-12-28' }];
    expect(defaultRosterIndex(list, '2026-12-05')).toBe(1);
    expect(defaultRosterIndex(list, '2026-12-20')).toBe(2);
    expect(defaultRosterIndex(list, '2027-02-01')).toBe(2);
    expect(defaultRosterIndex([], '2026-12-05')).toBe(-1);
  });

  it('finds a linked person in RNs or support staff', () => {
    const r = extractPublished(STATE, '2026-12-02').get('2026-11-30')!;
    expect(findRow(r, 'rn2')?.name).toBe('Omar Fares');
    expect(findRow(r, 'clk0')?.name).toBe('Dana');
    expect(findRow(r, null)).toBeNull();
    expect(rosterPeople([r]).map((p) => `${p.group}:${p.name}`)).toEqual(['RNs:Lina Saad', 'RNs:Omar Fares', 'Nurse Aides:Rami', 'Clerks:Dana']);
  });
});
