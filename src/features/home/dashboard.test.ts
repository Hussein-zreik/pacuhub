import { describe, expect, it } from 'vitest';
import { currentShift, firstNameOf, greeting } from './dashboard';

const at = (h: number) => new Date(2026, 10, 12, h, 0, 0);

const S = { dayStart: '07:00', dayEnd: '19:00' };
const currentShift_ = (d: Date) => currentShift(d, S);

describe('currentShift (Day 07:00–19:00, Night 19:00–07:00)', () => {
  it('is Day from 7am up to (not including) 7pm', () => {
    expect(currentShift_(at(7)).id).toBe('day');
    expect(currentShift_(at(12)).id).toBe('day');
    expect(currentShift_(at(18)).id).toBe('day');
  });
  it('is Night from 7pm to before 7am', () => {
    expect(currentShift_(at(19)).id).toBe('night');
    expect(currentShift_(at(23)).id).toBe('night');
    expect(currentShift_(at(0)).id).toBe('night');
    expect(currentShift_(at(6)).id).toBe('night');
  });
});

describe('greeting', () => {
  it('changes with the time of day', () => {
    expect(greeting(8)).toBe('Good morning');
    expect(greeting(14)).toBe('Good afternoon');
    expect(greeting(21)).toBe('Good evening');
  });
});

describe('firstNameOf', () => {
  it('prefers the display name, falls back to a capitalized email local part', () => {
    expect(firstNameOf('Rania Haddad', 'r@aub.edu.lb')).toBe('Rania');
    expect(firstNameOf(null, 'lina.saad@aub.edu.lb')).toBe('Lina.saad');
    expect(firstNameOf('  ', null)).toBeNull();
  });
});

describe('currentShift uses the unit shift times', () => {
  it('shows the configured hours', () => {
    expect(currentShift(new Date(2026, 10, 12, 8, 0), { dayStart: '07:30', dayEnd: '19:30' })).toEqual({
      id: 'day', label: 'Day shift', hours: '07:30 – 19:30',
    });
  });
});
