import { CheckCircle2, RefreshCw } from 'lucide-react';
import { Alert } from '@/components/ui';
import type { StoredRoster } from '@/services/roster/published';
import type { SyncStatus } from '../hooks/useRosterSync';

const short = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const time = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Manager-facing line: what staff can see and whether PACU Hub is in step with SNV2. */
export function RosterSyncStatus({ status, rosters }: { status: SyncStatus; rosters: StoredRoster[] | null }) {
  const count = rosters?.length ?? 0;
  const list = (rosters ?? []).map((r) => short(r.start)).join(', ');
  const published = (
    <p>
      <span className="font-semibold text-ink">
        Published to staff: {count} {count === 1 ? 'fortnight' : 'fortnights'}
      </span>
      {count > 0 && <> (starting {list})</>}
    </p>
  );

  switch (status.kind) {
    case 'not-configured':
      return <Alert tone="info">SNV2 isn't configured, so the roster can't be published automatically.</Alert>;
    case 'not-connected':
      return (
        <>
          {published}
          <Alert tone="warning">
            SNV2 isn't connected. Connect it in <span className="font-semibold">Day-off requests</span> above to publish newly locked
            fortnights. Staff keep seeing what was last published.
          </Alert>
        </>
      );
    case 'waiting':
      return (
        <p className="flex items-center gap-2">
          <RefreshCw className="size-4 animate-spin" aria-hidden="true" /> Checking SNV2…
        </p>
      );
    case 'no-roster':
      return <Alert tone="warning">This SNV2 login has no roster yet, so nothing was changed.</Alert>;
    case 'error':
      return (
        <>
          {published}
          <Alert tone="danger">{status.message}</Alert>
        </>
      );
    case 'synced':
      return (
        <>
          {published}
          <p className="flex items-center gap-2 text-success-700">
            <CheckCircle2 className="size-4" aria-hidden="true" /> In step with SNV2 · checked {time(status.checkedAt)}
          </p>
        </>
      );
  }
}
