import { Check, Trash2 } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Alert, Button, Input } from '@/components/ui';
import { normalizeRequestLink } from '@/services/schedule/requestLink';
import { useSaveRequestLink } from '../hooks/useScheduleSettings';

export function RequestLinkForm({ current }: { current: string | null }) {
  const id = useId();
  const save = useSaveRequestLink();
  const [value, setValue] = useState(current ?? '');
  const [invalid, setInvalid] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const link = normalizeRequestLink(value);
    if (!link) {
      setInvalid(true);
      return;
    }
    save.mutate(link, {
      onSuccess: () => {
        setValue(link);
        setSaved(true);
      },
    });
  };

  const remove = () =>
    save.mutate(null, {
      onSuccess: () => {
        setValue('');
        setSaved(false);
      },
    });

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <label htmlFor={id} className="sr-only">
        SNV2 staff request link
      </label>
      <Input
        id={id}
        type="url"
        inputMode="url"
        spellCheck={false}
        placeholder="https://hussein-zreik.github.io/SNV2/request.html?f=…"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setInvalid(false);
          setSaved(false);
        }}
        aria-invalid={invalid || undefined}
        disabled={save.isPending}
      />
      {invalid && <Alert tone="warning">That isn't an SNV2 staff request link. It should look like …/SNV2/request.html?f=…</Alert>}
      {save.isError && <Alert tone="danger">Couldn't save. You may not have permission, or the connection dropped.</Alert>}
      {saved && !save.isPending && <Alert tone="success">Saved. Staff now see the "Request a day off" button.</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={save.isPending} disabled={!value.trim()}>
          {!save.isPending && <Check />} Save link
        </Button>
        {current && (
          <Button variant="ghost" disabled={save.isPending} onClick={remove}>
            <Trash2 /> Remove
          </Button>
        )}
      </div>
    </form>
  );
}
