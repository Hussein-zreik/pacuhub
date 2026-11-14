/**
 * Manager set-up: bays (add, rename, reorder, remove), alert times, and the
 * unit capacity signal.
 */
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Alert, Button, Dialog, Input, SegmentedControl } from '@/components/ui';
import {
  BAY_NAME_MAX, CAPACITY_LABEL, CAPACITY_LEVELS, MINUTES_MAX, MINUTES_MIN, validThreshold,
  type Bay, type BoardConfig, type CapacityLevel, type Threshold,
} from '@/services/bayboard/model';
import { addBay, deleteBay, renameBay, saveBoardConfig, swapBays, type Actor } from '@/services/bayboard/bayService';

const errText = (e: unknown) =>
  (e as { code?: string }).code === 'permission-denied'
    ? 'Not allowed. You need Bay Board: Manage, and the latest security rules must be published.'
    : "Couldn't save. Check the connection and try again.";

function BayRow({ bay, first, last, onUp, onDown, actor, onError }: { bay: Bay; first: boolean; last: boolean; onUp: () => void; onDown: () => void; actor: Actor; onError: (m: string) => void }) {
  const [name, setName] = useState(bay.name);
  const [busy, setBusy] = useState(false);
  const removable = bay.status === 'empty' || bay.status === 'closed';
  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      onError(errText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="flex items-center gap-2 py-2">
      <Input aria-label={`Name of ${bay.name}`} value={name} maxLength={BAY_NAME_MAX} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1" />
      {name.trim() && name.trim() !== bay.name && (
        <Button size="icon" variant="secondary" aria-label={`Save name for ${bay.name}`} disabled={busy} onClick={() => void wrap(() => renameBay(bay.id, name, actor))}>
          <Check />
        </Button>
      )}
      <Button size="icon" variant="ghost" aria-label={`Move ${bay.name} up`} disabled={busy || first} onClick={onUp}>
        <ArrowUp />
      </Button>
      <Button size="icon" variant="ghost" aria-label={`Move ${bay.name} down`} disabled={busy || last} onClick={onDown}>
        <ArrowDown />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="text-danger-700"
        aria-label={`Remove ${bay.name}`}
        title={removable ? 'Remove bay' : 'Only an empty or closed bay can be removed'}
        disabled={busy || !removable}
        onClick={() => void wrap(() => deleteBay(bay.id))}
      >
        <Trash2 />
      </Button>
    </li>
  );
}

function ThresholdInputs({ label, value, onChange }: { label: string; value: Threshold; onChange: (t: Threshold) => void }) {
  const ids = { amber: useId(), red: useId() };
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-ink">{label}</legend>
      <div className="grid grid-cols-2 gap-3">
        {(['amber', 'red'] as const).map((k) => (
          <div key={k} className="space-y-1">
            <label htmlFor={ids[k]} className="text-xs font-semibold text-ink-muted">
              {k === 'amber' ? 'Amber after (min)' : 'Red after (min)'}
            </label>
            <Input id={ids[k]} type="number" inputMode="numeric" min={MINUTES_MIN} max={MINUTES_MAX} value={value[k]} onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) })} />
          </div>
        ))}
      </div>
    </fieldset>
  );
}

export function BoardSetup({ bays, config, actor, onClose }: { bays: Bay[]; config: BoardConfig; actor: Actor; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [count, setCount] = useState(8);
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(config.recovery);
  const [complete, setComplete] = useState(config.complete);
  const nextOrder = bays.length ? Math.max(...bays.map((b) => b.order)) + 1 : 0;

  const wrap = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      await fn();
      if (ok) setSaved(ok);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const createMany = () =>
    wrap(async () => {
      for (let i = 0; i < count; i++) await addBay(`Bay ${i + 1}`, i, actor);
    }, `${count} bays created.`);

  const timesValid = validThreshold(recovery) && validThreshold(complete);

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()} title="Set up the bay board" className="max-w-2xl" footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
      <div className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">Bays</h3>
          {bays.length === 0 ? (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line p-4">
              <div className="space-y-1">
                <label htmlFor="bay-count" className="text-xs font-semibold text-ink-muted">
                  How many bays?
                </label>
                <Input id="bay-count" type="number" min={1} max={40} value={count} onChange={(e) => setCount(Math.max(1, Math.min(40, Number(e.target.value) || 1)))} className="w-24" />
              </div>
              <Button onClick={() => void createMany()} loading={busy}>
                {!busy && <Plus />} Create Bay 1 – Bay {count}
              </Button>
              <p className="w-full text-xs text-ink-subtle">You can rename, reorder or add bays afterwards (e.g. "Isolation 1", "Peds 2").</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {bays.map((b, i) => (
                <BayRow
                  key={b.id}
                  bay={b}
                  first={i === 0}
                  last={i === bays.length - 1}
                  actor={actor}
                  onError={setError}
                  onUp={() => void wrap(() => swapBays(b, bays[i - 1]!, actor))}
                  onDown={() => void wrap(() => swapBays(b, bays[i + 1]!, actor))}
                />
              ))}
            </ul>
          )}
          {bays.length > 0 && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newName.trim()) void wrap(() => addBay(newName, nextOrder, actor).then(() => setNewName('')));
              }}
            >
              <Input aria-label="New bay name" placeholder="New bay name" value={newName} maxLength={BAY_NAME_MAX} onChange={(e) => setNewName(e.target.value)} className="flex-1" />
              <Button type="submit" variant="secondary" disabled={busy || !newName.trim()}>
                <Plus /> Add bay
              </Button>
            </form>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-ink">Alert times</h3>
          <p className="text-xs text-ink-muted">A bay card turns amber, then red, when its clock passes these times.</p>
          <ThresholdInputs label="Time in recovery" value={recovery} onChange={setRecovery} />
          <ThresholdInputs label="Waiting after Recovery Care Complete" value={complete} onChange={setComplete} />
          {!timesValid && <Alert tone="warning">Use whole minutes from {MINUTES_MIN} to {MINUTES_MAX}, with amber before red.</Alert>}
          <Button variant="secondary" disabled={busy || !timesValid} onClick={() => void wrap(() => saveBoardConfig({ ...config, recovery, complete }, actor), 'Alert times saved.')}>
            <Check /> Save alert times
          </Button>
        </section>

        {error && <Alert tone="danger">{error}</Alert>}
        {saved && <Alert tone="success">{saved}</Alert>}
      </div>
    </Dialog>
  );
}

export function CapacityDialog({ config, actor, onClose }: { config: BoardConfig; actor: Actor; onClose: () => void }) {
  const noteId = useId();
  const [level, setLevel] = useState<CapacityLevel>(config.capacity.level);
  const [note, setNote] = useState(config.capacity.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveBoardConfig({ ...config, capacity: { level, note } }, actor);
      onClose();
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !busy && onClose()}
      title="Unit capacity"
      description="Shown at the top of the bay board for everyone."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={busy}>
            {!busy && <Check />} Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <SegmentedControl
          label="Capacity level"
          value={level}
          onChange={(v) => setLevel(v as CapacityLevel)}
          options={CAPACITY_LEVELS.map((l) => ({ value: l, label: l === 'green' ? 'Green' : l === 'amber' ? 'Amber' : 'Red', description: CAPACITY_LABEL[l] }))}
        />
        <p className="text-sm text-ink-muted">{CAPACITY_LABEL[level]}</p>
        <div className="space-y-1.5">
          <label htmlFor={noteId} className="text-sm font-semibold text-ink">
            Note (optional)
          </label>
          <Input id={noteId} value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 2 bays closed for cleaning until 14:00" />
          <p className="text-xs text-ink-subtle">Unit status only. Don't enter patient details.</p>
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}
