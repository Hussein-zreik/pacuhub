import { describe, expect, it } from 'vitest';
import { alertLevel, applyAction, availableActions, BayActionError, boardCounts, DEFAULT_CONFIG, formatMinutes, todayStats, validThreshold, type Bay, type BayAction, type BayEvent } from './model';

const T0 = new Date('2026-11-14T08:00:00');
const at = (min: number) => new Date(T0.getTime() + min * 60000);
const bay = (over: Partial<Bay> = {}): Bay => ({
  id: 'b1', name: 'Bay 1', order: 0, status: 'empty', nurse: null, tags: [], delayReason: null,
  inRecoveryAt: null, careCompleteAt: null, updatedAt: null, updatedByName: null, ...over,
});
const me = { uid: 'u1', name: 'Lina Saad' };

describe('bay flow (Epic terms)', () => {
  it('Empty → In Recovery starts the recovery clock and records an "in" event', () => {
    const { patch, event } = applyAction(bay(), { type: 'place', nurse: me, tags: ['oxygen', 'oxygen', 'bogus' as never] }, T0);
    expect(patch).toMatchObject({ status: 'in-recovery', nurse: me, tags: ['oxygen'], inRecoveryAt: 'now', careCompleteAt: null });
    expect(event?.action).toBe('in');
  });

  it('In Recovery → Recovery Care Complete keeps the start time and logs minutes in recovery', () => {
    const b = bay({ status: 'in-recovery', nurse: me, inRecoveryAt: T0 });
    const { patch, event } = applyAction(b, { type: 'complete' }, at(75));
    expect(patch).toMatchObject({ status: 'care-complete', inRecoveryAt: T0, careCompleteAt: 'now', nurse: me });
    expect(event).toMatchObject({ action: 'complete', recoveryMin: 75 });
  });

  it('Out of Recovery empties the bay at once and logs recovery + wait time and the delay reason', () => {
    const b = bay({ status: 'care-complete', nurse: me, tags: ['isolation'], delayReason: 'awaiting-bed', inRecoveryAt: T0, careCompleteAt: at(80) });
    const { patch, event } = applyAction(b, { type: 'out' }, at(125));
    expect(patch).toEqual({ status: 'empty', nurse: null, tags: [], delayReason: null, inRecoveryAt: null, careCompleteAt: null });
    expect(event).toEqual({ action: 'out', delayReason: 'awaiting-bed', recoveryMin: 80, waitMin: 45 });
  });

  it('Out straight from In Recovery counts recovery time with no wait', () => {
    const { event } = applyAction(bay({ status: 'in-recovery', inRecoveryAt: T0 }), { type: 'out' }, at(50));
    expect(event).toMatchObject({ recoveryMin: 50, waitMin: null });
  });

  it('back to In Recovery clears care-complete time and any delay reason', () => {
    const b = bay({ status: 'care-complete', inRecoveryAt: T0, careCompleteAt: at(60), delayReason: 'other' });
    expect(applyAction(b, { type: 'back-to-recovery' }, at(70)).patch).toMatchObject({ status: 'in-recovery', careCompleteAt: null, delayReason: null });
  });

  it('delay reason only applies after Recovery Care Complete', () => {
    const edit: BayAction = { type: 'edit', nurse: me, tags: [], delayReason: 'awaiting-bed' };
    expect(applyAction(bay({ status: 'in-recovery', inRecoveryAt: T0 }), edit, at(5)).patch.delayReason).toBeNull();
    expect(applyAction(bay({ status: 'care-complete', inRecoveryAt: T0, careCompleteAt: T0 }), edit, at(5)).patch.delayReason).toBe('awaiting-bed');
  });

  it('refuses a step that no longer fits (someone else changed the bay)', () => {
    expect(() => applyAction(bay({ status: 'in-recovery' }), { type: 'place', nurse: null, tags: [] }, T0)).toThrow(BayActionError);
    expect(() => applyAction(bay(), { type: 'out' }, T0)).toThrow(/Bay 1 is now Empty/);
  });

  it('only managers can close or reopen a bay', () => {
    expect(availableActions({ status: 'empty' }, false)).toEqual(['place']);
    expect(availableActions({ status: 'empty' }, true)).toEqual(['place', 'close']);
    expect(availableActions({ status: 'closed' }, false)).toEqual([]);
    expect(availableActions({ status: 'closed' }, true)).toEqual(['open']);
  });
});

describe('timers and alerts', () => {
  it('turns amber then red on the right clock for each status', () => {
    const rec = bay({ status: 'in-recovery', inRecoveryAt: T0 });
    expect(alertLevel(rec, DEFAULT_CONFIG, at(59))).toBe('ok');
    expect(alertLevel(rec, DEFAULT_CONFIG, at(60))).toBe('amber');
    expect(alertLevel(rec, DEFAULT_CONFIG, at(120))).toBe('red');
    const done = bay({ status: 'care-complete', inRecoveryAt: T0, careCompleteAt: at(100) });
    expect(alertLevel(done, DEFAULT_CONFIG, at(129))).toBe('ok'); // waiting 29 min
    expect(alertLevel(done, DEFAULT_CONFIG, at(130))).toBe('amber');
    expect(alertLevel(done, DEFAULT_CONFIG, at(160))).toBe('red');
    expect(alertLevel(bay(), DEFAULT_CONFIG, at(999))).toBe('ok');
  });

  it('formats elapsed time for a glance', () => {
    expect(formatMinutes(7)).toBe('7 min');
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(95)).toBe('1 h 35');
  });

  it('validates manager thresholds', () => {
    expect(validThreshold({ amber: 30, red: 60 })).toBe(true);
    expect(validThreshold({ amber: 60, red: 60 })).toBe(false);
    expect(validThreshold({ amber: 2, red: 60 })).toBe(false);
  });
});

describe('board summary', () => {
  it('counts bays by status', () => {
    expect(boardCounts([bay(), bay({ status: 'in-recovery' }), bay({ status: 'closed' })])).toEqual({ empty: 1, 'in-recovery': 1, 'care-complete': 0, closed: 1 });
  });

  it("computes today's numbers from flow events", () => {
    const ev = (o: Partial<BayEvent>): BayEvent => ({ id: Math.random().toString(), bayId: 'b', at: T0, action: 'out', delayReason: null, recoveryMin: null, waitMin: null, ...o });
    const s = todayStats([
      ev({ action: 'in' }), ev({ action: 'in' }), ev({ action: 'in' }),
      ev({ recoveryMin: 60, waitMin: 10, delayReason: 'awaiting-bed' }),
      ev({ recoveryMin: 90, waitMin: 50, delayReason: 'awaiting-bed' }),
      ev({ recoveryMin: 45, waitMin: null, delayReason: 'awaiting-transport' }),
    ]);
    expect(s).toEqual({ admitted: 3, outOfRecovery: 3, avgRecoveryMin: 65, avgWaitMin: 30, delays: [['awaiting-bed', 2], ['awaiting-transport', 1]] });
  });
});
