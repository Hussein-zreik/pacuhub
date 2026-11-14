/**
 * Activity log (admins). Read-only, newest first, filterable by type.
 * Entries can't be edited or deleted — see firestore.rules.
 */
import { CalendarCheck, History, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Card, EmptyState, SegmentedControl, Skeleton } from '@/components/ui';
import { watchActivity, type ActivityEntry, type ActivityType } from '@/services/activity/activityLog';
import { formatDateTime } from '@/utils/format';

const TYPE_META: Record<ActivityType, { label: string; tone: 'brand' | 'success' | 'neutral'; Icon: typeof History }> = {
  access: { label: 'Access', tone: 'brand', Icon: ShieldCheck },
  settings: { label: 'Settings', tone: 'neutral', Icon: SlidersHorizontal },
  dayoff: { label: 'Day off', tone: 'success', Icon: CalendarCheck },
};

type Filter = 'all' | ActivityType;

export function ActivityLog() {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(
    () =>
      watchActivity(
        (e) => {
          setEntries(e);
          setError(null);
        },
        () => setError("Couldn't load the activity log. Make sure the latest security rules are published."),
      ),
    [],
  );

  const shown = useMemo(() => (entries ?? []).filter((e) => filter === 'all' || e.type === filter), [entries, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Filter activity"
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'access', label: 'Access' },
            { value: 'dayoff', label: 'Day off' },
            { value: 'settings', label: 'Settings' },
          ]}
        />
        <p className="text-xs text-ink-subtle">Last 200 actions taken in PACU Hub. Entries can’t be edited or deleted.</p>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <Card className="overflow-hidden">
        {entries === null && !error ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-3/5" />
          </div>
        ) : shown.length === 0 ? (
          <EmptyState icon={History} title="Nothing recorded yet" description="Access changes, day-off decisions and unit setting changes will appear here." />
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((e) => {
              const meta = TYPE_META[e.type];
              return (
                <li key={e.id} className="flex items-start gap-3 px-5 py-3">
                  <meta.Icon className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">{e.summary}</p>
                    <p className="mt-0.5 text-xs text-ink-subtle">
                      {e.byName || 'Unknown'} · {e.at ? formatDateTime(e.at) : 'just now'}
                    </p>
                  </div>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
