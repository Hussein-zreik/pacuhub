/**
 * Dashboard data, pulled from shared SERVICES (not other features, per the
 * module-boundary rules). Query keys match the Staff Access and Schedule
 * features so the cache is shared and stays fresh.
 */
import { useQuery } from '@tanstack/react-query';
import { getScheduleSettings } from '@/services/schedule/scheduleSettingsService';
import { listUserProfiles } from '@/services/users/userProfileService';

/** Count of people awaiting approval. Admin-only (the query is gated by `enabled`). */
export function usePendingApprovals(enabled: boolean) {
  const query = useQuery({
    queryKey: ['staff-access', 'staff'],
    queryFn: listUserProfiles,
    enabled,
    refetchInterval: enabled ? 60_000 : false,
  });
  return { count: (query.data ?? []).filter((p) => p.status === 'pending').length, isLoading: query.isLoading };
}

/** The SNV2 day-off request link, if an admin has set one. */
export function useRequestLink(enabled: boolean) {
  const query = useQuery({
    queryKey: ['schedule', 'settings'],
    queryFn: getScheduleSettings,
    enabled,
    staleTime: 5 * 60_000,
  });
  return query.data?.requestLink ?? null;
}
