/** Data hooks for the Staff Access module (TanStack Query over the user service). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { listUserProfiles, updateUserAccess } from '@/services/users/userProfileService';
import type { AccessChange } from '@/services/users/types';

const STAFF_KEY = ['staff-access', 'staff'] as const;

export function useStaffList() {
  return useQuery({ queryKey: STAFF_KEY, queryFn: listUserProfiles, refetchInterval: 60_000 });
}

export function useUpdateAccess() {
  const queryClient = useQueryClient();
  const { state } = useAuth();
  const adminUid = state.status === 'authorized' ? state.user.uid : '';

  return useMutation({
    mutationFn: ({ uid, change }: { uid: string; change: AccessChange }) => updateUserAccess(uid, change, adminUid),
    onSettled: () => queryClient.invalidateQueries({ queryKey: STAFF_KEY }),
  });
}
