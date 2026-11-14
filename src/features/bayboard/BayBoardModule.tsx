/**
 * Live PACU bay board. Real-time across every screen (Firestore listeners);
 * timers tick every 30 s. No patient data is stored — see services/bayboard.
 */
import { Maximize2, Minimize2, Settings2, Signal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import { usePermissions } from '@/core/permissions/usePermissions';
import {
  boardCounts, CAPACITY_LABEL, DELAY_LABEL, formatMinutes, STATUS_LABEL, todayStats, type BayAction, type BayStatus,
} from '@/services/bayboard/model';
import { runBayAction } from '@/services/bayboard/bayService';
import { cn } from '@/utils/cn';
import { BayCard } from './components/BayCard';
import { BayDialog } from './components/BayDialog';
import { BoardSetup, CapacityDialog } from './components/BoardSetup';
import { useActor, useAssignableNurses, useBayBoard, useNow } from './hooks/useBayBoard';

const CAPACITY_STYLE = {
  green: 'border-success-600/40 bg-success-50 text-success-700',
  amber: 'border-warning-600/50 bg-warning-50 text-warning-700',
  red: 'border-danger-600/50 bg-danger-50 text-danger-700',
} as const;

const COUNT_ORDER: BayStatus[] = ['in-recovery', 'care-complete', 'empty', 'closed'];

export default function BayBoardModule() {
  const { can } = usePermissions();
  const canUpdate = can('bayboard', 'update');
  const canManage = can('bayboard', 'manage');
  const { bays, config, events, error } = useBayBoard();
  const now = useNow();
  const actor = useActor();
  const nurses = useAssignableNurses();
  const [openId, setOpenId] = useState<string | null>(null);
  const [setup, setSetup] = useState(false);
  const [capacity, setCapacity] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const on = () => setFullscreen(document.fullscreenElement === boardRef.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void boardRef.current?.requestFullscreen?.();
  };

  const open = bays?.find((b) => b.id === openId) ?? null;
  const counts = boardCounts(bays ?? []);
  const stats = todayStats(events);
  const act = async (action: BayAction) => {
    if (!open || !actor) return;
    try {
      await runBayAction(open.id, action, actor);
    } catch (e) {
      if ((e as { code?: string }).code === 'permission-denied') throw new Error('Not allowed. Ask an admin for Bay Board access.');
      throw e;
    }
  };

  return (
    <>
      <PageHeader
        title="Bay Board"
        description="Live PACU bays, the same steps as the Epic snapboard. No patient details are stored here."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={toggleFullscreen}>
              {fullscreen ? <Minimize2 /> : <Maximize2 />} {fullscreen ? 'Exit full screen' : 'Full screen'}
            </Button>
            {canManage && (
              <Button variant="secondary" size="sm" onClick={() => setSetup(true)}>
                <Settings2 /> Set up
              </Button>
            )}
          </div>
        }
      />

      <div ref={boardRef} className={cn('space-y-4', fullscreen && 'overflow-auto bg-canvas p-6')}>
        {/* Capacity signal */}
        <div className={cn('flex flex-wrap items-center gap-3 rounded-xl border-2 px-4 py-3', CAPACITY_STYLE[config.capacity.level])} role="status">
          <Signal className="size-5 shrink-0" aria-hidden="true" />
          <p className="font-semibold">
            PACU {config.capacity.level.toUpperCase()} · {CAPACITY_LABEL[config.capacity.level]}
          </p>
          {config.capacity.note && <p className="text-sm">— {config.capacity.note}</p>}
          {canManage && (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setCapacity(true)}>
              Change
            </Button>
          )}
        </div>

        {/* Counts + today */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {COUNT_ORDER.map((s) => (
            <span key={s} className="text-ink-muted">
              <span className="text-lg font-bold tabular-nums text-ink">{counts[s]}</span> {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
        <p className="text-xs text-ink-muted">
          <span className="font-semibold text-ink">Today:</span> {stats.admitted} placed in recovery · {stats.outOfRecovery} out of recovery
          {stats.avgRecoveryMin !== null && <> · average recovery {formatMinutes(stats.avgRecoveryMin)}</>}
          {stats.avgWaitMin !== null && <> · average wait after care complete {formatMinutes(stats.avgWaitMin)}</>}
          {stats.delays[0] && (
            <>
              {' '}· most common delay: {DELAY_LABEL[stats.delays[0][0]]} ({stats.delays[0][1]})
            </>
          )}
        </p>

        {error && <Alert tone="warning">Couldn't load the bay board. Check your access and the connection, then reload.</Alert>}

        {bays === null ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : bays.length === 0 && !error ? (
          <EmptyState
            icon={Signal}
            title="No bays set up yet"
            description={canManage ? 'Use Set up to create the PACU bays.' : 'A charge nurse or manager needs to set up the bays first.'}
            action={
              canManage ? (
                <Button onClick={() => setSetup(true)}>
                  <Settings2 /> Set up bays
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className={cn('grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5', fullscreen && '2xl:grid-cols-6')}>
            {bays.map((b) => (
              <li key={b.id}>
                <BayCard bay={b} config={config} now={now} onOpen={() => setOpenId(b.id)} />
              </li>
            ))}
          </ul>
        )}
        {!canUpdate && bays && bays.length > 0 && <p className="text-xs text-ink-subtle">You have view-only access to the bay board.</p>}
      </div>

      {open && (
        <BayDialog key={`${open.id}-${open.status}`} bay={open} now={now} canUpdate={canUpdate} canManage={canManage} nurses={nurses} onAction={act} onClose={() => setOpenId(null)} />
      )}
      {setup && actor && <BoardSetup bays={bays ?? []} config={config} actor={actor} onClose={() => setSetup(false)} />}
      {capacity && actor && <CapacityDialog config={config} actor={actor} onClose={() => setCapacity(false)} />}
    </>
  );
}
