import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { logger } from '@/services/monitoring/logger';
import { watchPublishedRosters } from '@/services/roster/publishedRosters';
import type { StoredRoster } from '@/services/roster/published';
import { watchUserProfile } from '@/services/users/userProfileService';

/** Live published fortnights (oldest first). `rosters` is null while loading. */
export function usePublishedRosters(enabled = true) {
  const [rosters, setRosters] = useState<StoredRoster[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    return watchPublishedRosters(
      (next) => {
        setRosters(next);
        setError(false);
      },
      (e) => {
        logger.warn('Published rosters unavailable', { error: String(e) });
        setError(true);
        setRosters([]);
      },
    );
  }, [enabled]);
  return { rosters, error };
}

/** The signed-in person's SNV2 roster id (linked by an admin in Staff Access). */
export function useMyRosterId(): string | null {
  const { state } = useAuth();
  const uid = state.status === 'authorized' ? state.user.uid : null;
  const [rosterId, setRosterId] = useState<string | null>(null);
  useEffect(() => {
    if (!uid) return;
    return watchUserProfile(
      uid,
      (p) => setRosterId(p?.rosterId ?? null),
      () => setRosterId(null),
    );
  }, [uid]);
  return uid ? rosterId : null;
}
