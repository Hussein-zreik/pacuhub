import { Ban, Clock, Hourglass, UserRound } from 'lucide-react';
import {
  alertLevel, bayClock, DELAY_LABEL, formatMinutes, minutesBetween, STATUS_LABEL, TAG_LABEL, type Bay, type BoardConfig,
} from '@/services/bayboard/model';
import { cn } from '@/utils/cn';

const STATUS_STYLE: Record<Bay['status'], { card: string; chip: string }> = {
  empty: { card: 'border-dashed border-line bg-surface', chip: 'bg-chip text-ink-muted' },
  'in-recovery': { card: 'border-brand-300 bg-surface', chip: 'bg-brand-600 text-white' },
  'care-complete': { card: 'border-success-600/60 bg-surface', chip: 'bg-success-600 text-white' },
  closed: { card: 'border-line bg-canvas', chip: 'bg-chip text-ink-subtle' },
};

const ALERT_STYLE = {
  ok: { ring: '', time: 'text-ink' },
  amber: { ring: 'ring-4 ring-warning-600/50 border-warning-600', time: 'text-warning-700' },
  red: { ring: 'ring-4 ring-danger-600/50 border-danger-600', time: 'text-danger-700' },
} as const;

export function BayCard({ bay, config, now, onOpen, disabled }: { bay: Bay; config: BoardConfig; now: Date; onOpen: () => void; disabled?: boolean }) {
  const style = STATUS_STYLE[bay.status];
  const clock = bayClock(bay);
  const minutes = clock ? (minutesBetween(clock.since, now) ?? 0) : null;
  const alert = alertLevel(bay, config, now);
  const a = ALERT_STYLE[alert];
  const total = bay.status === 'care-complete' ? minutesBetween(bay.inRecoveryAt, bay.careCompleteAt ?? now) : null;

  const label = [
    bay.name,
    STATUS_LABEL[bay.status],
    minutes !== null && clock ? `${formatMinutes(minutes)} ${clock.label}` : '',
    alert !== 'ok' ? `${alert} alert` : '',
    bay.nurse ? `nurse ${bay.nurse.name}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'flex min-h-44 w-full flex-col rounded-xl border-2 p-4 text-left shadow-card transition-shadow hover:shadow-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 disabled:cursor-default disabled:hover:shadow-card',
        style.card,
        a.ring,
      )}
    >
      <span className="truncate text-xl font-bold text-ink">{bay.name}</span>
      <span className={cn('mt-1 self-start rounded-full px-2 py-0.5 text-xs font-semibold', style.chip)}>{STATUS_LABEL[bay.status]}</span>

      {bay.status === 'empty' && <p className="mt-auto pt-4 text-sm text-ink-subtle">Available</p>}
      {bay.status === 'closed' && (
        <p className="mt-auto flex items-center gap-1.5 pt-4 text-sm text-ink-subtle">
          <Ban className="size-4" aria-hidden="true" /> Out of service
        </p>
      )}

      {minutes !== null && clock && (
        <div className="mt-3">
          <p className={cn('flex items-center gap-1.5 text-2xl font-bold tabular-nums', a.time)}>
            {bay.status === 'care-complete' ? <Hourglass className="size-5" aria-hidden="true" /> : <Clock className="size-5" aria-hidden="true" />}
            {formatMinutes(minutes)}
          </p>
          <p className="text-xs text-ink-muted">
            {clock.label}
            {total !== null && <> · {formatMinutes(total)} in recovery</>}
          </p>
        </div>
      )}

      {(bay.nurse || bay.tags.length > 0 || bay.delayReason) && (
        <div className="mt-auto space-y-2 pt-3">
          {bay.nurse && (
            <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
              <UserRound className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" /> {bay.nurse.name}
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            {bay.delayReason && (
              <span className="rounded-md bg-warning-50 px-1.5 py-0.5 text-xs font-semibold text-warning-700">{DELAY_LABEL[bay.delayReason]}</span>
            )}
            {bay.tags.map((t) => (
              <span key={t} className="rounded-md bg-chip px-1.5 py-0.5 text-xs font-semibold text-ink-muted">
                {TAG_LABEL[t]}
              </span>
            ))}
          </div>
        </div>
      )}
    </button>
  );
}
