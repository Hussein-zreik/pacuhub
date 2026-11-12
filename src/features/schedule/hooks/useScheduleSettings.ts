import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { getScheduleSettings, saveRequestLink } from '@/services/schedule/scheduleSettingsService';

const KEY = ['schedule', 'settings'] as const;

export function useScheduleSettings() {
  return useQuery({ queryKey: KEY, queryFn: getScheduleSettings, staleTime: 5 * 60_000 });
}

export function useSaveRequestLink() {
  const queryClient = useQueryClient();
  const { state } = useAuth();
  const uid = state.status === 'authorized' ? state.user.uid : '';
  return useMutation({
    mutationFn: (link: string | null) => saveRequestLink(link, uid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
