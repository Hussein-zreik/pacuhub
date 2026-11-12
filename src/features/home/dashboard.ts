/**
 * Pure helpers for the Home dashboard (no React, no Firebase) so they're easy
 * to test.
 */
export type Shift = { id: 'day' | 'night'; label: string };

/**
 * PACU runs two 12-hour shifts: Day 07:00–19:00, Night 19:00–07:00.
 * `hour` is the local hour (0–23).
 */
export function currentShift(date: Date): Shift {
  const hour = date.getHours();
  return hour >= 7 && hour < 19 ? { id: 'day', label: 'Day shift' } : { id: 'night', label: 'Night shift' };
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
