import { describe, expect, it } from 'vitest';
import { currentShift, firstNameOf, greeting } from './dashboard';

const at = (h: number) => new Date(2026, 10, 12, h, 0, 0);

describe('currentShift (Day 07:00–19:00, Night 19:00–07:00)', () => {
  it('is Day from 7am up to (not including) 7pm', () => {
    expect(currentShift(at(7)).id).toBe('day');
    expect(currentShift(at(12)).id).toBe('day');
    expect(currentShift(at(18)).id).toBe('day');
  });
  it('is Night from 7pm to before 7am', () => {
    expect(currentShift(at(19)).id).toBe('night');
    expect(currentShift(at(23)).id).toBe('night');
    expect(currentShift(at(0)).id).toBe('night');
    expect(currentShift(at(6)).id).toBe('night');
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
