import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePublishedRosters } from '@/hooks/usePublishedRosters';
import { DEFAULT_CONFIG, type Bay, type BayEvent, type BoardConfig, type Nurse } from '@/services/bayboard/model';
import { watchBays, watchBoardConfig, watchTodayEvents, type Actor } from '@/services/bayboard/bayService';
import { logger } from '@/services/monitoring/logger';
import { cycleDays, cycleEnd, isWorking } from '@/services/roster/published';
import { todayIso } from '@/utils/format';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Live bays, board settings and today's flow events. */
export function useBayBoard() {
  const [bays, setBays] = useState<Bay[] | null>(null);
  const [config, setConfig] = useState<BoardConfig>(DEFAULT_CONFIG);
  const [events, setEvents] = useState<BayEvent[]>([]);
  const [error, setError] = useState(false);
  const [day, setDay] = useState(todayIso());

  useEffect(
    () =>
      watchBays(
        (b) => {
          setBays(b);
          setError(false);
        },
        (e) => {
          logger.warn('Bay board unavailable', { error: String(e) });
          setError(true);
          setBays([]);
        },
      ),
    [],
  );
  useEffect(() => watchBoardConfig(setConfig, (e) => logger.warn('Board settings unavailable', { error: String(e) })), []);
  useEffect(() => watchTodayEvents(startOfToday(), setEvents, (e) => logger.warn('Bay events unavailable', { error: String(e) })), [day]);
  // Roll "today" over at midnight on a screen left open.
  useEffect(() => {
    const t = setInterval(() => setDay((d) => (d === todayIso() ? d : todayIso())), 60_000);
    return () => clearInterval(t);
  }, []);

  return { bays, config, events, error };
}

/** Re-render every `ms` so timers stay current. */
export function useNow(ms = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function useActor(): Actor | null {
  const { state } = useAuth();
  return useMemo(
    () => (state.status === 'authorized' ? { uid: state.user.uid, name: state.user.displayName || state.user.email || 'Unknown' } : null),
    [state],
  );
}

/**
 * Who can be assigned to a bay: me, plus RNs working today on the published
 * roster (when this person can see the roster).
 */
export function useAssignableNurses(): Nurse[] {
  const me = useActor();
  const { rosters } = usePublishedRosters();
  return useMemo(() => {
    const today = todayIso();
    const out: Nurse[] = me ? [{ uid: me.uid, name: me.name }] : [];
    const r = (rosters ?? []).find((x) => x.start <= today && today <= cycleEnd(x.start));
    if (r) {
      const i = cycleDays(r.start).indexOf(today);
      for (const rn of r.rns) if (isWorking(rn.row[i] ?? 'OFF') && !out.some((n) => n.name === rn.name)) out.push({ uid: null, name: rn.name });
    }
    return out;
  }, [me, rosters]);
}
