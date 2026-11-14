/**
 * Day-off requests from staff, shown inside PACU Hub (read from SNV2).
 *
 * Requests are private to the SNV2 manager, so the manager connects their SNV2
 * login once; the session is per-tab and cleared on PACU Hub sign-out.
 */
import { CalendarCheck, CheckCircle2, Circle, Eye, EyeOff, LinkIcon, Loader2, LogOut, Unplug } from 'lucide-react';
import { useId, useMemo, useState, type FormEvent } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Input, Skeleton } from '@/components/ui';
import type { DayOffRequest } from '@/services/snv2/requestsService';
import { cn } from '@/utils/cn';
import { useSnv2Requests } from '../hooks/useSnv2Requests';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatDates(dates: string[]): string {
  return dates
    .map((iso) => {
      const d = new Date(`${iso}T00:00:00`);
      return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    })
    .join(', ');
}

function formatWhen(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function ConnectForm({ connect, connecting, error }: { connect: (e: string, p: string) => void; connecting: boolean; error: string | null }) {
  const ids = { email: useId(), password: useId() };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!EMAIL_PATTERN.test(email.trim())) return setLocalError('Enter the SNV2 manager email.');
    if (!password) return setLocalError('Enter the SNV2 password.');
    connect(email, password);
  };

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <LinkIcon className="size-4 text-brand-600" aria-hidden="true" />
        Connect your SNV2 manager login to see day-off requests here. You stay connected until you sign out.
      </div>
      <form className="mt-4 grid gap-3 sm:max-w-sm" onSubmit={submit} noValidate>
        <Input
          id={ids.email}
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="SNV2 manager email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setLocalError(null); }}
          disabled={connecting}
        />
        <div className="relative">
          <Input
            id={ids.password}
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="SNV2 password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setLocalError(null); }}
            disabled={connecting}
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-subtle hover:text-ink"
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
        {(localError ?? error) && <Alert tone="danger">{localError ?? error}</Alert>}
        <Button type="submit" loading={connecting}>
          {!connecting && <LinkIcon />} Connect SNV2
        </Button>
      </form>
    </div>
  );
}

function RequestItem({ request, onToggle }: { request: DayOffRequest; onToggle: (done: boolean) => void }) {
  const [saving, setSaving] = useState(false);
  const toggle = async () => {
    setSaving(true);
    try {
      await onToggle(!request.done);
    } finally {
      setSaving(false);
    }
  };
  return (
    <li className={cn('flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between', request.done && 'opacity-60')}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
          {request.name || 'Unknown'}
          {request.done && <Badge tone="success">Handled</Badge>}
        </p>
        <p className="mt-0.5 text-sm font-medium text-brand-700">{formatDates(request.dates) || 'No valid dates'}</p>
        {request.reason && <p className="mt-1 text-sm text-ink-muted">“{request.reason}”</p>}
        {request.createdAt && <p className="mt-1 text-xs text-ink-subtle">Sent {formatWhen(request.createdAt)}</p>}
      </div>
      <Button size="sm" variant={request.done ? 'ghost' : 'secondary'} onClick={() => void toggle()} loading={saving} className="shrink-0">
        {!saving && (request.done ? <Circle /> : <CheckCircle2 />)}
        {request.done ? 'Mark not done' : 'Mark done'}
      </Button>
    </li>
  );
}

export function StaffRequests({ formId }: { formId: string | null }) {
  const snv2 = useSnv2Requests(formId);
  const [showHandled, setShowHandled] = useState(false);

  const pending = useMemo(() => snv2.requests.filter((r) => !r.done), [snv2.requests]);
  const visible = showHandled ? snv2.requests : pending;

  if (!snv2.configured) {
    return <Alert tone="info">Day-off requests aren't connected. An administrator can set the SNV2 project in configuration.</Alert>;
  }
  if (!formId) {
    return <Alert tone="info">Set the SNV2 staff request link above first — the requests come from that form.</Alert>;
  }
  if (snv2.initializing) return <Skeleton className="h-24" />;

  if (!snv2.manager) {
    return <ConnectForm connect={(e, p) => void snv2.connect(e, p)} connecting={snv2.connecting} error={snv2.connectError} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Badge tone="brand">{pending.length} new</Badge>
          <span>Connected as {snv2.manager.email}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowHandled((v) => !v)}>
            {showHandled ? 'Hide handled' : 'Show handled'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void snv2.disconnect()}>
            <LogOut /> Disconnect
          </Button>
        </div>
      </div>

      {snv2.requestsError && <Alert tone="danger">{snv2.requestsError}</Alert>}

      <Card className="overflow-hidden">
        {snv2.loadingRequests ? (
          <div className="flex items-center gap-2 px-5 py-6 text-sm text-ink-muted">
            <Loader2 className="size-4 animate-spin" /> Loading requests…
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={snv2.requests.length === 0 ? CalendarCheck : Unplug}
            title={snv2.requests.length === 0 ? 'No day-off requests yet' : 'No new requests'}
            description={snv2.requests.length === 0 ? 'Requests staff send from the link will appear here.' : 'All caught up — everything is handled.'}
          />
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((request) => (
              <RequestItem key={request.id} request={request} onToggle={(done) => snv2.setDone(request.id, done)} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
