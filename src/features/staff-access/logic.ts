import type { AccessStatus, UserProfile } from '@/services/users/types';

export type StaffFilter = AccessStatus;

export const FILTER_LABELS: Record<StaffFilter, string> = {
  pending: 'Requests',
  active: 'Active',
  disabled: 'Deactivated',
};

export function countByStatus(staff: readonly UserProfile[]): Record<StaffFilter, number> {
  const counts: Record<StaffFilter, number> = { pending: 0, active: 0, disabled: 0 };
  for (const person of staff) counts[person.status] += 1;
  return counts;
}

export function filterStaff(staff: readonly UserProfile[], filter: StaffFilter, search: string): UserProfile[] {
  const term = search.trim().toLowerCase();
  return staff
    .filter((person) => person.status === filter)
    .filter((person) => !term || `${person.displayName ?? ''} ${person.email ?? ''}`.toLowerCase().includes(term))
    .sort((a, b) => (a.displayName ?? a.email ?? '').localeCompare(b.displayName ?? b.email ?? ''));
}

export function friendlySaveError(error: unknown): string {
  const code = (error as { code?: string }).code;
  if (code === 'permission-denied') return "You don't have permission to change this person's access.";
  if (code === 'unavailable') return "Couldn't save — check the network connection and try again.";
  return 'Saving failed. Please try again.';
}
