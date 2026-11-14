import { describe, expect, it } from 'vitest';
import { applyReqOff, isDateLocked, removeReqOff, todayIso, type RosterState } from './roster';

const base = (): RosterState => ({
  ids: ['n0', 'n1', 'n2'],
  names: ['Lina', 'Omar', 'Rania'],
  overrides: { '2026-11-20': { n1: 'VAC' } },
  notes: {},
  lockedCycles: { '2026-11-02': { at: '2026-11-01', rns: [] } }, // locks 2026-11-02 … 2026-11-15
  frozen: { untouched: true },
});
const TODAY = '2026-11-14';

describe('isDateLocked', () => {
  it('covers the 14 days from the cycle Monday', () => {
    const lc = { '2026-11-02': {} };
    expect(isDateLocked(lc, '2026-11-02')).toBe(true);
    expect(isDateLocked(lc, '2026-11-15')).toBe(true);
    expect(isDateLocked(lc, '2026-11-16')).toBe(false);
    expect(isDateLocked(lc, '2026-11-01')).toBe(false);
    expect(isDateLocked(undefined, '2026-11-05')).toBe(false);
  });
});

describe('applyReqOff (approve)', () => {
  it('writes Req off + the reason as comment, exactly like SNV2', () => {
    const r = applyReqOff(base(), { rnId: 'n0', dates: ['2026-11-21', '2026-11-22'], reason: ' Family event ', today: TODAY });
    expect(r.changed).toBe(true);
    expect(r.applied).toEqual(['2026-11-21', '2026-11-22']);
    expect((r.state.overrides as Record<string, Record<string, string>>)['2026-11-21']).toEqual({ n0: 'REQ' });
    expect((r.state.notes as Record<string, Record<string, string>>)['2026-11-22']).toEqual({ n0: 'Family event' });
  });

  it('preserves everything else in the roster untouched', () => {
    const s = base();
    const r = applyReqOff(s, { rnId: 'n0', dates: ['2026-11-21'], reason: '', today: TODAY });
    expect(r.state.frozen).toEqual({ untouched: true });
    expect(r.state.lockedCycles).toEqual(s.lockedCycles);
    expect((r.state.overrides as Record<string, unknown>)['2026-11-20']).toEqual({ n1: 'VAC' });
    expect(s.overrides).toEqual({ '2026-11-20': { n1: 'VAC' } }); // input not mutated
  });

  it('keeps other nurses on the same day', () => {
    const r = applyReqOff(base(), { rnId: 'n0', dates: ['2026-11-20'], reason: '', today: TODAY });
    expect((r.state.overrides as Record<string, unknown>)['2026-11-20']).toEqual({ n1: 'VAC', n0: 'REQ' });
  });

  it('skips locked fortnights, past dates and existing entries — never overwrites', () => {
    const s = base();
    (s.overrides as Record<string, Record<string, string>>)['2026-11-25'] = { n0: 'S9' };
    const r = applyReqOff(s, { rnId: 'n0', dates: ['2026-11-10', '2026-11-13', '2026-11-25', '2026-11-26'], reason: '', today: TODAY });
    expect(r.applied).toEqual(['2026-11-26']);
    expect(r.skipped).toEqual([
      { date: '2026-11-10', why: 'date has passed' },
      { date: '2026-11-13', why: 'date has passed' },
      { date: '2026-11-25', why: 'already has "S9" that day' },
    ]);
    expect((r.state.overrides as Record<string, Record<string, string>>)['2026-11-25']).toEqual({ n0: 'S9' });
  });

  it('skips a locked (future) fortnight', () => {
    const s = base();
    s.lockedCycles = { '2026-11-16': {} };
    const r = applyReqOff(s, { rnId: 'n0', dates: ['2026-11-18'], reason: '', today: TODAY });
    expect(r.changed).toBe(false);
    expect(r.skipped[0]?.why).toMatch(/locked/);
  });

  it('does not overwrite an existing comment', () => {
    const s = base();
    s.notes = { '2026-11-21': { n0: 'manager note' } };
    const r = applyReqOff(s, { rnId: 'n0', dates: ['2026-11-21'], reason: 'reason', today: TODAY });
    expect(r.notesWritten).toEqual([]);
    expect((r.state.notes as Record<string, Record<string, string>>)['2026-11-21']).toEqual({ n0: 'manager note' });
  });

  it('refuses a nurse who is no longer on the roster', () => {
    const r = applyReqOff(base(), { rnId: 'n9', dates: ['2026-11-21'], reason: '', today: TODAY });
    expect(r.changed).toBe(false);
    expect(r.skipped[0]?.why).toMatch(/not on the SNV2 roster/);
  });

  it('treats an existing Req off as already done (and does not claim it)', () => {
    const s = base();
    s.overrides = { '2026-11-21': { n0: 'REQ' } };
    const r = applyReqOff(s, { rnId: 'n0', dates: ['2026-11-21'], reason: '', today: TODAY });
    expect(r.applied).toEqual([]);
    expect(r.skipped[0]?.why).toMatch(/already Req off/);
  });
});

describe('removeReqOff (undo)', () => {
  const approved = () => applyReqOff(base(), { rnId: 'n0', dates: ['2026-11-21', '2026-11-22'], reason: 'Exam', today: TODAY });

  it('restores the roster exactly as it was', () => {
    const a = approved();
    const r = removeReqOff(a.state, { rnId: 'n0', applied: a.applied, notesWritten: a.notesWritten, reason: 'Exam' });
    expect(r.removed).toEqual(['2026-11-21', '2026-11-22']);
    expect(r.state.overrides).toEqual(base().overrides);
    expect(r.state.notes).toEqual({});
  });

  it('leaves days changed in SNV2 alone', () => {
    const a = approved();
    (a.state.overrides as Record<string, Record<string, string>>)['2026-11-21'] = { n0: 'S9' };
    const r = removeReqOff(a.state, { rnId: 'n0', applied: a.applied, notesWritten: a.notesWritten, reason: 'Exam' });
    expect(r.changedInSnv2).toEqual(['2026-11-21']);
    expect(r.removed).toEqual(['2026-11-22']);
    expect((r.state.overrides as Record<string, Record<string, string>>)['2026-11-21']).toEqual({ n0: 'S9' });
  });

  it('cannot undo inside a fortnight locked since approval', () => {
    const a = approved();
    a.state.lockedCycles = { '2026-11-16': {} };
    const r = removeReqOff(a.state, { rnId: 'n0', applied: a.applied, notesWritten: a.notesWritten, reason: 'Exam' });
    expect(r.locked).toEqual(['2026-11-21', '2026-11-22']);
    expect(r.changed).toBe(false);
  });

  it('keeps a comment the manager edited after approval', () => {
    const a = approved();
    (a.state.notes as Record<string, Record<string, string>>)['2026-11-21'] = { n0: 'edited by manager' };
    const r = removeReqOff(a.state, { rnId: 'n0', applied: a.applied, notesWritten: a.notesWritten, reason: 'Exam' });
    expect((r.state.notes as Record<string, Record<string, string>>)['2026-11-21']).toEqual({ n0: 'edited by manager' });
  });
});

describe('todayIso', () => {
  it('uses the local calendar day', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});
