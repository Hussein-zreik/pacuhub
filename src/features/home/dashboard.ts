/**
 * Pure helpers for the Home dashboard (no React, no Firebase) so they're easy
 * to test.
 */
import { isDayShift, type ShiftTimes } from '@/services/settings/model';

export type Shift = { id: 'day' | 'night'; label: string; hours: string };

/** Two shifts set in unit settings: Day [dayStart, dayEnd), Night = the rest. */
export function currentShift(date: Date, shifts: ShiftTimes): Shift {
  return isDayShift(date, shifts)
    ? { id: 'day', label: 'Day shift', hours: `${shifts.dayStart} – ${shifts.dayEnd}` }
    : { id: 'night', label: 'Night shift', hours: `${shifts.dayEnd} – ${shifts.dayStart}` };
}

export function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function firstNameOf(displayName: string | null | undefined, email: string | null | undefined): string | null {
  const name = displayName?.trim().split(/\s+/)[0];
  if (name) return name;
  const local = email?.split('@')[0];
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : null;
}
