/**
 * Actions for one bay. What's offered depends on the bay's status and the
 * person's level; the transaction re-checks the bay, so a stale screen can't
 * overwrite someone else's change.
 */
import { CheckCircle2, DoorOpen, LogOut, Lock, RotateCcw, Save, Unlock } from 'lucide-react';
import { useId, useState } from 'react';
import { Alert, Button, Dialog, SegmentedControl, Select } from '@/components/ui';
import {
  availableActions, BAY_TAGS, DELAY_LABEL, DELAY_REASONS, formatMinutes, minutesBetween, STATUS_LABEL, TAG_LABEL,
  type Bay, type BayAction, type BayTag, type DelayReason, type Nurse,
} from '@/services/bayboard/model';
import { cn } from '@/utils/cn';

const time = (d: Date | null) => (d ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '');

function NursePicker({ value, options, onChange, disabled }: { value: Nurse | null; options: Nurse[]; onChange: (n: Nurse | null) => void; disabled: boolean }) {
  const id = useId();
  const all = value && !options.some((o) => o.name === value.name) ? [value, ...options] : options;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        Assigned nurse
      </label>
      <Select id={id} value={value?.name ?? ''} disabled={disabled} onChange={(e) => onChange(all.find((n) => n.name === e.target.value) ?? null)}>
        <option value="">Unassigned</option>
        {all.map((n, i) => (
          <option key={n.name} value={n.name}>
            {n.name}
            {i === 0 && options[0]?.name === n.name && n.uid ? ' (me)' : ''}
          </option>
        ))}
      </Select>
    </div>
  );
}

function TagPicker({ value, onChange, disabled }: { value: BayTag[]; onChange: (t: BayTag[]) => void; disabled: boolean }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-semibold text-ink">Quick tags</legend>
      <div className="flex flex-wrap gap-2">
        {BAY_TAGS.map((t) => {
          const on = value.includes(t);
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => onChange(on ? value.filter((x) => x !== t) : [...value, t])}
              className={cn(
                'min-h-10 rounded-full border px-3.5 text-sm font-semibold transition-colors',
                on ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface text-ink-muted hover:border-brand-300 hover:text-ink',
              )}
            >
              {TAG_LABEL[t]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export interface BayDialogProps {
  bay: Bay;
  now: Date;
  canUpdate: boolean;
  canManage: boolean;
  nurses: Nurse[];
  onAction: (action: BayAction) => Promise<void>;
  onClose: () => void;
}

export function BayDialog({ bay, now, canUpdate, canManage, nurses, onAction, onClose }: BayDialogProps) {
  const actions = canUpdate || canManage ? availableActions(bay, canManage) : [];
  const [nurse, setNurse] = useState<Nurse | null>(bay.status === 'empty' ? (nurses[0] ?? null) : bay.nurse);
  const [tags, setTags] = useState<BayTag[]>(bay.tags);
  const [delay, setDelay] = useState<DelayReason | 'none'>(bay.delayReason ?? 'none');
  const [busy, setBusy] = useState<BayAction['type'] | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: BayAction) => {
    setBusy(action.type);
    setError(null);
    try {
      await onAction(action);
      onClose();
    } catch (e) {
      setError((e as Error).message || "Couldn't update the bay. Please try again.");
      setBusy(null);
    }
  };

  const edited =
    (nurse?.name ?? null) !== (bay.nurse?.name ?? null) ||
    tags.join() !== bay.tags.join() ||
    (bay.status === 'care-complete' && (delay === 'none' ? null : delay) !== bay.delayReason);
  const occupied = bay.status === 'in-recovery' || bay.status === 'care-complete';
  const disabled = busy !== null;
  const inMin = minutesBetween(bay.inRecoveryAt, now);
  const waitMin = bay.status === 'care-complete' ? minutesBetween(bay.careCompleteAt, now) : null;

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !busy && onClose()}
      title={`${bay.name} · ${STATUS_LABEL[bay.status]}`}
      description={
        occupied ? (
          <>
            In recovery since {time(bay.inRecoveryAt)} ({formatMinutes(inMin ?? 0)})
            {waitMin !== null && <> · care complete at {time(bay.careCompleteAt)} ({formatMinutes(waitMin)} waiting)</>}
          </>
        ) : bay.status === 'empty' ? (
          'Available for the next patient.'
        ) : (
          'Out of service.'
        )
      }
      footer={
        <p className="mr-auto text-xs text-ink-subtle">
          {bay.updatedAt && `Last change ${time(bay.updatedAt)}${bay.updatedByName ? ` by ${bay.updatedByName}` : ''}`}
        </p>
      }
    >
      <div className="space-y-5">
        {/* Main flow buttons */}
        <div className="flex flex-wrap gap-2">
          {actions.includes('place') && (
            <Button size="lg" onClick={() => void run({ type: 'place', nurse, tags })} loading={busy === 'place'} disabled={disabled} data-autofocus>
              {busy !== 'place' && <DoorOpen />} Place in recovery
            </Button>
          )}
          {actions.includes('complete') && (
            <Button size="lg" onClick={() => void run({ type: 'complete' })} loading={busy === 'complete'} disabled={disabled} data-autofocus>
              {busy !== 'complete' && <CheckCircle2 />} Recovery care complete
            </Button>
          )}
          {actions.includes('out') &&
            (confirmOut ? (
              <Button size="lg" variant="danger" onClick={() => void run({ type: 'out' })} loading={busy === 'out'} disabled={disabled}>
                {busy !== 'out' && <LogOut />} Confirm: out of recovery
              </Button>
            ) : (
              <Button
                size="lg"
                variant={bay.status === 'care-complete' ? 'primary' : 'secondary'}
                onClick={() => setConfirmOut(true)}
                disabled={disabled}
                data-autofocus={bay.status === 'care-complete' ? true : undefined}
              >
                <LogOut /> Out of recovery
              </Button>
            ))}
          {actions.includes('back-to-recovery') && (
            <Button variant="ghost" onClick={() => void run({ type: 'back-to-recovery' })} loading={busy === 'back-to-recovery'} disabled={disabled}>
              {busy !== 'back-to-recovery' && <RotateCcw />} Back to In Recovery
            </Button>
          )}
          {actions.includes('open') && (
            <Button size="lg" onClick={() => void run({ type: 'open' })} loading={busy === 'open'} disabled={disabled} data-autofocus>
              {busy !== 'open' && <Unlock />} Open bay
            </Button>
          )}
          {actions.length === 0 && <p className="text-sm text-ink-muted">You can view this bay but not change it.</p>}
        </div>
        {confirmOut && <p className="text-sm text-ink-muted">The bay will be emptied straight away, as in Epic.</p>}

        {/* Details */}
        {(actions.includes('place') || actions.includes('edit')) && (
          <div className="space-y-4 rounded-lg border border-line p-4">
            {bay.status === 'care-complete' && (
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-ink">Delay reason</p>
                <SegmentedControl
                  label="Delay reason"
                  value={delay}
                  disabled={disabled}
                  onChange={(v) => setDelay(v as DelayReason | 'none')}
                  options={[{ value: 'none', label: 'None' }, ...DELAY_REASONS.map((r) => ({ value: r, label: DELAY_LABEL[r] }))]}
                  className="flex-wrap"
                />
              </div>
            )}
            <NursePicker value={nurse} options={nurses} onChange={setNurse} disabled={disabled} />
            <TagPicker value={tags} onChange={setTags} disabled={disabled} />
            {actions.includes('edit') && (
              <Button
                variant="secondary"
                onClick={() => void run({ type: 'edit', nurse, tags, delayReason: delay === 'none' ? null : delay })}
                loading={busy === 'edit'}
                disabled={disabled || !edited}
              >
                {busy !== 'edit' && <Save />} Save changes
              </Button>
            )}
          </div>
        )}

        {actions.includes('close') && (
          <Button variant="ghost" className="text-ink-muted" onClick={() => void run({ type: 'close' })} loading={busy === 'close'} disabled={disabled}>
            {busy !== 'close' && <Lock />} Close bay (out of service)
          </Button>
        )}

        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}
