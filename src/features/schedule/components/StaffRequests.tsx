/**
 * Day-off requests from staff, shown inside PACU Hub (read from SNV2).
 *
 * Requests are private to the SNV2 manager, so the manager connects their SNV2
 * login once; the session is per-tab and cleared on PACU Hub sign-out.
 */
import { CalendarCheck, Check, Eye, EyeOff, History, Inbox, LinkIcon, Loader2, LogOut, RotateCcw, X } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Alert, Badge, Button, Card, Dialog, EmptyState, Input, Skeleton } from '@/components/ui';
import type { DayOffDecision } from '@/services/schedule/dayOffDecisions';
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
        Connect your SNV2 manager login to handle day-off requests here and publish locked fortnights to staff. You stay connected until you sign out of PACU Hub.
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

type Feedback = { tone: 'success' | 'warning' | 'danger'; text: string } | null;

const skippedText = (skipped: { date: string; why: string }[]) =>
  skipped.map((s) => `${formatDates([s.date])} (${s.why})`).join(', ');

function PendingItem({
  request,
  onApprove,
  onReject,
}: {
  request: DayOffRequest;
  onApprove: () => Promise<{ applied: string[]; skipped: { date: string; why: string }[] }>;
  onReject: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const run = async (kind: 'approve' | 'reject') => {
    setBusy(kind);
    setFeedback(null);
    try {
      if (kind === 'approve') {
        const r = await onApprove();
        if (r.skipped.length) setFeedback({ tone: 'warning', text: `Approved. Not added: ${skippedText(r.skipped)}.` });
      } else {
        await onReject();
      }
    } catch (error) {
      setFeedback({ tone: 'danger', text: (error as Error).message || 'Something went wrong. Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{request.name || 'Unknown'}</p>
          <p className="mt-0.5 text-sm font-medium text-accent">{formatDates(request.dates) || 'No valid dates'}</p>
          {request.reason && <p className="mt-1 text-sm text-ink-muted">“{request.reason}”</p>}
          {request.createdAt && <p className="mt-1 text-xs text-ink-subtle">Sent {formatWhen(request.createdAt)}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={() => void run('approve')} loading={busy === 'approve'} disabled={busy !== null}>
            {busy !== 'approve' && <Check />} Approve
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="text-danger-700"
            onClick={() => void run('reject')}
            loading={busy === 'reject'}
            disabled={busy !== null}
          >
            {busy !== 'reject' && <X />} Reject
          </Button>
        </div>
      </div>
      {feedback && <Alert tone={feedback.tone} className="mt-3">{feedback.text}</Alert>}
    </li>
  );
}

function HistoryItem({ decision, onUndo }: { decision: DayOffDecision; onUndo: () => void }) {
  const approved = decision.decision === 'approved';
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
          {decision.name || 'Unknown'}
          <Badge tone={approved ? 'success' : 'danger'}>{approved ? 'Approved' : 'Rejected'}</Badge>
        </p>
        <p className="mt-0.5 text-sm font-medium text-accent">{formatDates(decision.dates)}</p>
        {decision.reason && <p className="mt-1 text-sm text-ink-muted">“{decision.reason}”</p>}
        {approved && decision.applied.length > 0 && (
          <p className="mt-1 text-xs text-success-700">Added to roster as Req off: {formatDates(decision.applied)}</p>
        )}
        {decision.skipped.length > 0 && <p className="mt-1 text-xs text-warning-700">Not added: {skippedText(decision.skipped)}</p>}
        {decision.decidedAt && <p className="mt-1 text-xs text-ink-subtle">Decided {formatWhen(decision.decidedAt)}</p>}
      </div>
      <Button size="sm" variant="secondary" onClick={onUndo} className="shrink-0">
        <RotateCcw /> Undo
      </Button>
    </li>
  );
}

export function StaffRequests({ formId }: { formId: string | null }) {
  const snv2 = useSnv2Requests(formId);
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [confirmUndo, setConfirmUndo] = useState<DayOffDecision | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [undoMessage, setUndoMessage] = useState<Feedback>(null);

  if (!snv2.configured) {
    return <Alert tone="info">Day-off requests aren't connected. An administrator can set the SNV2 project in configuration.</Alert>;
  }
  if (snv2.initializing) return <Skeleton className="h-24" />;
  // Connecting also turns on automatic roster publishing, so offer it even before the request link is set.
  if (!snv2.manager) {
    return <ConnectForm connect={(e, p) => void snv2.connect(e, p)} connecting={snv2.connecting} error={snv2.connectError} />;
  }
  if (!formId) {
    return <Alert tone="info">Set the SNV2 staff request link below first — the requests come from that form.</Alert>;
  }

  const doUndo = async () => {
    if (!confirmUndo) return;
    setUndoing(true);
    setUndoMessage(null);
    try {
      const r = await snv2.undo(confirmUndo);
      const notes: string[] = [];
      if (r.locked.length) notes.push(`${formatDates(r.locked)} stay Req off — that fortnight is locked in SNV2`);
      if (r.changedInSnv2.length) notes.push(`${formatDates(r.changedInSnv2)} had been changed in SNV2 and were left as they are`);
      setUndoMessage(
        notes.length
          ? { tone: 'warning', text: `Partly undone: ${notes.join('; ')}.` }
          : { tone: 'success', text: `${confirmUndo.name}'s request is back in Pending.` },
      );
      setConfirmUndo(null);
    } catch (error) {
      setUndoMessage({ tone: 'danger', text: (error as Error).message || 'Undo failed. Please try again.' });
      setConfirmUndo(null);
    } finally {
      setUndoing(false);
    }
  };

  const historyCount = snv2.decisions.length + snv2.handledElsewhere.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Day-off requests" className="inline-flex rounded-lg border border-line bg-surface p-1 shadow-sm">
          {(
            [
              ['pending', 'Pending', snv2.pending.length, Inbox],
              ['history', 'History', historyCount, History],
            ] as const
          ).map(([key, label, count, Icon]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                'flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors',
                tab === key ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-brand-50 hover:text-ink',
              )}
            >
              <Icon className="size-4" aria-hidden="true" /> {label}
              <span className={cn('rounded-full px-1.5 text-xs tabular-nums', tab === key ? 'bg-white/20' : 'bg-canvas')}>{count}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <span>SNV2: {snv2.manager.email}</span>
          <Button size="sm" variant="ghost" onClick={() => void snv2.disconnect()}>
            <LogOut /> Disconnect
          </Button>
        </div>
      </div>

      {snv2.requestsError && <Alert tone="danger">{snv2.requestsError}</Alert>}
      {undoMessage && <Alert tone={undoMessage.tone}>{undoMessage.text}</Alert>}

      <Card className="overflow-hidden">
        {snv2.loadingRequests ? (
          <div className="flex items-center gap-2 px-5 py-6 text-sm text-ink-muted">
            <Loader2 className="size-4 animate-spin" /> Loading requests…
          </div>
        ) : tab === 'pending' ? (
          snv2.pending.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No pending requests" description="New requests staff send from the link will appear here." />
          ) : (
            <ul className="divide-y divide-line">
              {snv2.pending.map((request) => (
                <PendingItem
                  key={request.id}
                  request={request}
                  onApprove={() => snv2.approve(request)}
                  onReject={() => snv2.reject(request)}
                />
              ))}
            </ul>
          )
        ) : historyCount === 0 ? (
          <EmptyState icon={History} title="No history yet" description="Approved and rejected requests will be listed here." />
        ) : (
          <ul className="divide-y divide-line">
            {snv2.decisions.map((decision) => (
              <HistoryItem key={decision.id} decision={decision} onUndo={() => setConfirmUndo(decision)} />
            ))}
            {snv2.handledElsewhere.map((request) => (
              <li key={request.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {request.name || 'Unknown'} <Badge>Handled in SNV2</Badge>
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-accent">{formatDates(request.dates)}</p>
                </div>
                <Button size="sm" variant="secondary" className="shrink-0" onClick={() => void snv2.reopen(request.id)}>
                  <RotateCcw /> Reopen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {confirmUndo && (
        <Dialog
          open
          onOpenChange={(open) => !open && !undoing && setConfirmUndo(null)}
          title={confirmUndo.decision === 'approved' ? 'Undo approval?' : 'Undo rejection?'}
          description={
            confirmUndo.decision === 'approved' ? (
              <>
                The Req off days PACU Hub added for <span className="font-semibold text-ink">{confirmUndo.name}</span> will be removed
                from the SNV2 roster, and the request goes back to Pending.
              </>
            ) : (
              <>
                <span className="font-semibold text-ink">{confirmUndo.name}</span>'s request goes back to Pending so you can decide again.
              </>
            )
          }
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmUndo(null)} disabled={undoing} data-autofocus>
                Cancel
              </Button>
              <Button onClick={() => void doUndo()} loading={undoing}>
                {!undoing && <RotateCcw />} Undo
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}
