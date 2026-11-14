/**
 * Published roster (staff view): the fortnights locked in SNV2, as a grid,
 * with the signed-in nurse's own row highlighted and a "My shifts" strip.
 * Shift codes and names only — SNV2 comments are never published.
 */
import { CalendarDays, ChevronLeft, ChevronRight, Lock, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert, Badge, Button, EmptyState, Skeleton } from '@/components/ui';
import { CORE_SHIFTS, cycleDays, cycleEnd, defaultRosterIndex, findRow, isWorking, shiftLabel, type RosterRow, type StoredRoster } from '@/services/roster/published';
import { cn } from '@/utils/cn';
import { todayIso } from '@/utils/format';
import { ShiftBadge } from './ShiftBadge';

const local = (iso: string) => new Date(`${iso}T00:00:00`);
const dayName = (iso: string) => local(iso).toLocaleDateString('en-GB', { weekday: 'short' });
const dayNum = (iso: string) => local(iso).getDate();
const shortDate = (iso: string, year = false) =>
  local(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
const isWeekend = (iso: string) => [0, 6].includes(local(iso).getDay());

function MyShifts({ row, days, roster, today }: { row: RosterRow; days: string[]; roster: StoredRoster; today: string }) {
  const working = row.row.filter(isWorking).length;
  const nextIdx = days.findIndex((d, i) => d >= today && isWorking(row.row[i]!));
  return (
    <section aria-labelledby="my-shifts" className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 id="my-shifts" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <UserRound className="size-4 text-brand-600" aria-hidden="true" /> My shifts · {row.name}
        </h4>
        <p className="text-xs text-ink-muted">
          {working} working {working === 1 ? 'shift' : 'shifts'}
          {nextIdx >= 0 && (
            <>
              {' '}· next: <span className="font-semibold text-ink">{dayName(days[nextIdx]!)} {shortDate(days[nextIdx]!)}</span>,{' '}
              {row.row[nextIdx]} ({shiftLabel(row.row[nextIdx]!, roster.shifts)})
            </>
          )}
        </p>
      </div>
      <ol className="mt-3 grid grid-cols-7 gap-1.5">
        {days.map((d, i) => (
          <li
            key={d}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border border-line bg-surface px-1 py-2 text-center',
              d === today && 'border-brand-600 ring-2 ring-brand-600/30',
              d < today && 'opacity-60',
            )}
            aria-label={`${dayName(d)} ${shortDate(d)}: ${shiftLabel(row.row[i]!, roster.shifts)}`}
          >
            <span className="text-[0.7rem] font-semibold uppercase text-ink-subtle">{dayName(d)}</span>
            <span className="text-xs text-ink-muted">{dayNum(d)}</span>
            <ShiftBadge code={row.row[i]!} custom={roster.shifts} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function Grid({ roster, days, mine, today }: { roster: StoredRoster; days: string[]; mine: string | null; today: string }) {
  const body = (rows: RosterRow[]) =>
    rows.map((r) => {
      const me = r.id === mine;
      return (
        <tr key={r.id} className={cn('border-t border-line', me && 'bg-brand-50')} aria-current={me ? 'true' : undefined}>
          <th scope="row" className={cn('sticky left-0 z-10 max-w-44 truncate px-3 py-1.5 text-left text-sm font-medium text-ink', me ? 'bg-brand-50' : 'bg-surface')}>
            {r.name}
            {me && (
              <Badge tone="brand" className="ml-2">
                You
              </Badge>
            )}
          </th>
          {r.row.map((c, i) => (
            <td key={days[i]} className={cn('px-0.5 py-1 text-center', isWeekend(days[i]!) && !me && 'bg-canvas', days[i] === today && 'bg-brand-100/60')}>
              <ShiftBadge code={c} custom={roster.shifts} />
            </td>
          ))}
        </tr>
      );
    });

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <caption className="sr-only">Roster {shortDate(roster.start)} to {shortDate(cycleEnd(roster.start), true)}</caption>
        <thead>
          <tr className="bg-canvas">
            <th scope="col" className="sticky left-0 z-10 bg-canvas px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Name
            </th>
            {days.map((d) => (
              <th key={d} scope="col" className={cn('px-0.5 py-2 text-center text-xs font-semibold', d === today ? 'text-accent-strong' : 'text-ink-muted')}>
                <span className="block uppercase">{dayName(d)}</span>
                <span className={cn('mt-0.5 inline-flex size-6 items-center justify-center rounded-full', d === today && 'bg-brand-600 text-white')}>{dayNum(d)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body(roster.rns)}
          {roster.groups.map((g) => [
            <tr key={`h-${g.label}`} className="border-t border-line bg-canvas">
              <th scope="colgroup" colSpan={15} className="sticky left-0 px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {g.label}
              </th>
            </tr>,
            ...body(g.rows),
          ])}
        </tbody>
      </table>
    </div>
  );
}

function Legend({ roster }: { roster: StoredRoster }) {
  const used = new Set([...roster.rns, ...roster.groups.flatMap((g) => g.rows)].flatMap((r) => r.row));
  const codes = [...Object.keys(CORE_SHIFTS), ...roster.shifts.map((s) => s.code)].filter((c) => used.has(c) && c !== 'OFF');
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-muted" aria-label="Shift key">
      {codes.map((c) => (
        <li key={c} className="flex items-center gap-1.5">
          <ShiftBadge code={c} custom={roster.shifts} /> {shiftLabel(c, roster.shifts)}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <ShiftBadge code="OFF" custom={[]} /> Day off
      </li>
    </ul>
  );
}

export interface PublishedRosterProps {
  rosters: StoredRoster[] | null;
  error: boolean;
  rosterId: string | null;
  isManager: boolean;
}

export function PublishedRoster({ rosters, error, rosterId, isManager }: PublishedRosterProps) {
  const today = todayIso();
  const list = useMemo(() => rosters ?? [], [rosters]);
  const [picked, setPicked] = useState<number | null>(null);
  const index = picked !== null && picked < list.length ? picked : defaultRosterIndex(list, today);

  if (rosters === null) return <Skeleton className="h-64" />;
  if (error) return <Alert tone="warning">Couldn't load the roster. Check the connection and reload.</Alert>;
  if (index < 0)
    return (
      <EmptyState
        icon={CalendarDays}
        title="No published roster yet"
        description={
          isManager
            ? 'Lock a fortnight in SNV2, then keep SNV2 connected in Manager tools below. Locked fortnights appear here automatically.'
            : 'The roster appears here once the Nurse Manager locks a fortnight in SNV2.'
        }
        className="py-10"
      />
    );

  const roster = list[index]!;
  const days = cycleDays(roster.start);
  const end = cycleEnd(roster.start);
  const when = today < roster.start ? 'Upcoming' : today > end ? 'Past' : 'Current';
  const myRow = findRow(roster, rosterId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" aria-label="Previous fortnight" disabled={index === 0} onClick={() => setPicked(index - 1)}>
            <ChevronLeft />
          </Button>
          <p className="text-center text-base font-semibold text-ink sm:min-w-44" aria-live="polite">
            {shortDate(roster.start)} – {shortDate(end, true)}
          </p>
          <Button variant="secondary" size="sm" aria-label="Next fortnight" disabled={index === list.length - 1} onClick={() => setPicked(index + 1)}>
            <ChevronRight />
          </Button>
          <Badge tone={when === 'Current' ? 'success' : when === 'Upcoming' ? 'brand' : 'neutral'}>{when}</Badge>
        </div>
        {roster.lockedAt && (
          <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
            <Lock className="size-3.5" aria-hidden="true" /> Final · locked {shortDate(roster.lockedAt.slice(0, 10))}
          </p>
        )}
      </div>

      {myRow ? (
        <MyShifts row={myRow} days={days} roster={roster} today={today} />
      ) : rosterId ? (
        <Alert tone="info">You're not on this fortnight's roster.</Alert>
      ) : (
        <Alert tone="info">
          To see your own shifts highlighted, ask your Nurse Manager to link your account to your name on the roster (Staff Access).
        </Alert>
      )}

      <Grid roster={roster} days={days} mine={myRow ? rosterId : null} today={today} />
      <Legend roster={roster} />
    </div>
  );
}
