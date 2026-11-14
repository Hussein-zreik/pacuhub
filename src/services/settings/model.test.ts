import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APP, DEFAULT_PREFS, DEFAULT_PUBLIC, announcementActive, effectiveIdle, emailDomainAllowed, isDayShift,
  parseApp, parseDomainList, parsePrefs, parsePublic,
} from './model';

describe('defaults', () => {
  it('match the current behaviour', () => {
    expect(DEFAULT_PUBLIC).toEqual({ signup: { enabled: true, allowedDomains: [] }, idle: { maxMinutes: 5, warningSeconds: 60 } });
    expect(DEFAULT_APP).toEqual({ shifts: { dayStart: '07:00', dayEnd: '19:00' }, announcement: null, defaultTemplate: 'staff-nurse' });
    expect(DEFAULT_PREFS).toEqual({ theme: 'light', textSize: 'normal', startPage: null, idleMinutes: null });
  });

  it('out-of-range or malformed values fall back safely (never "no sign-out")', () => {
    expect(parsePublic({ idle: { maxMinutes: 9999, warningSeconds: 60 } }).idle.maxMinutes).toBe(5);
    expect(parsePublic({ idle: { maxMinutes: 0, warningSeconds: 60 } }).idle.maxMinutes).toBe(5);
    expect(parseApp({ shifts: { dayStart: '25:00', dayEnd: '19:00' } }).shifts).toEqual({ dayStart: '07:00', dayEnd: '19:00' });
    expect(parsePrefs({ theme: 'neon', idleMinutes: 600 })).toMatchObject({ theme: 'light', idleMinutes: null });
  });
});

describe('effectiveIdle — unit maximum, personal may only be shorter', () => {
  const pub = parsePublic({ idle: { maxMinutes: 10, warningSeconds: 60 } });
  it('uses the unit time by default', () => expect(effectiveIdle(pub, null).minutes).toBe(10));
  it('honours a shorter personal time', () => expect(effectiveIdle(pub, parsePrefs({ idleMinutes: 3 })).minutes).toBe(3));
  it('caps a longer personal time at the unit maximum', () => expect(effectiveIdle(pub, parsePrefs({ idleMinutes: 20 })).minutes).toBe(10));
  it('never lets the warning exceed the timeout', () => {
    const e = effectiveIdle(parsePublic({ idle: { maxMinutes: 2, warningSeconds: 120 } }), parsePrefs({ idleMinutes: 2 }));
    expect(e.warningMs).toBeLessThanOrEqual(e.timeoutMs);
  });
});

describe('isDayShift', () => {
  const at = (h: number, m = 0) => new Date(2026, 10, 14, h, m);
  it('standard 07:00–19:00', () => {
    const s = { dayStart: '07:00', dayEnd: '19:00' };
    expect(isDayShift(at(7), s)).toBe(true);
    expect(isDayShift(at(18, 59), s)).toBe(true);
    expect(isDayShift(at(19), s)).toBe(false);
    expect(isDayShift(at(6, 59), s)).toBe(false);
  });
  it('custom 07:30–19:30', () => {
    const s = { dayStart: '07:30', dayEnd: '19:30' };
    expect(isDayShift(at(7, 15), s)).toBe(false);
    expect(isDayShift(at(19, 15), s)).toBe(true);
  });
});

describe('announcementActive', () => {
  const a = { text: 'Fire drill', tone: 'info' as const, expiresOn: '2026-11-20' };
  it('shows until and including the expiry day', () => {
    expect(announcementActive(a, '2026-11-20')).toBe(true);
    expect(announcementActive(a, '2026-11-21')).toBe(false);
    expect(announcementActive({ ...a, expiresOn: null }, '2030-01-01')).toBe(true);
    expect(announcementActive(null, '2026-11-20')).toBe(false);
  });
});

describe('sign-up domains', () => {
  it('allows everything when no list is set; otherwise matches case-insensitively', () => {
    expect(emailDomainAllowed('a@gmail.com', [])).toBe(true);
    expect(emailDomainAllowed('Nurse@AUB.edu.lb', ['aub.edu.lb'])).toBe(true);
    expect(emailDomainAllowed('nurse@gmail.com', ['aub.edu.lb'])).toBe(false);
  });
  it('parses a typed list and reports invalid entries', () => {
    expect(parseDomainList(' @AUB.edu.lb, aubmc.org.lb ; nonsense ')).toEqual({ domains: ['aub.edu.lb', 'aubmc.org.lb'], invalid: ['nonsense'] });
  });
});
