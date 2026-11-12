/** Approve a request, or edit/restore a staff member's roles. */
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, Dialog } from '@/components/ui';
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from '@/config/permissions';
import type { AccessChange, UserProfile } from '@/services/users/types';
import { cn } from '@/utils/cn';
import { friendlySaveError } from '../logic';

export type AccessDialogMode = 'approve' | 'edit' | 'reactivate';

const COPY: Record<AccessDialogMode, { title: string; confirm: string }> = {
  approve: { title: 'Approve access request', confirm: 'Approve access' },
  edit: { title: 'Edit roles', confirm: 'Save changes' },
  reactivate: { title: 'Reactivate access', confirm: 'Reactivate' },
};

export interface AccessDialogProps {
  person: UserProfile;
  mode: AccessDialogMode;
  saving: boolean;
  error: unknown;
  onSubmit: (change: AccessChange) => void;
  onClose: () => void;
}

export function AccessDialog({ person, mode, saving, error, onSubmit, onClose }: AccessDialogProps) {
  // New requests default to Staff Nurse — the most common role — but nothing is saved until confirmed.
  const [selected, setSelected] = useState<Role[]>(person.roles.length ? person.roles : ['staff_nurse']);
  const [touched, setTouched] = useState(false);
  const copy = COPY[mode];
  const invalid = selected.length === 0;

  const toggle = (role: Role) =>
    setSelected((current) => (current.includes(role) ? current.filter((r) => r !== role) : ROLES.filter((r) => r === role || current.includes(r))));

  const submit = () => {
    setTouched(true);
    if (!invalid) onSubmit({ roles: selected, status: 'active' });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !saving && onClose()}
      title={copy.title}
      description={
        <>
          <span className="font-semibold text-ink">{person.displayName ?? person.email}</span>
          {person.displayName && <> · {person.email}</>}
        </>
      }
      footer={
        <>
          {mode === 'approve' ? (
            <Button variant="secondary" disabled={saving} onClick={() => onSubmit({ roles: [], status: 'disabled' })}>
              <X /> Decline request
            </Button>
          ) : (
            <Button variant="secondary" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button onClick={submit} loading={saving} data-autofocus>
            {!saving && <Check />} {copy.confirm}
          </Button>
        </>
      }
    >
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Roles</legend>
        <div className="space-y-2">
          {ROLES.map((role) => {
            const checked = selected.includes(role);
            return (
              <label
                key={role}
                className={cn(
                  'flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                  checked ? 'border-brand-300 bg-brand-50' : 'border-line hover:bg-canvas',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0 accent-brand-600"
                  checked={checked}
                  onChange={() => toggle(role)}
                  disabled={saving}
                />
                <span>
                  <span className="block text-sm font-semibold text-ink">{ROLE_LABELS[role]}</span>
                  <span className="block text-xs text-ink-muted">{ROLE_DESCRIPTIONS[role]}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-3 space-y-2">
        {touched && invalid && <Alert tone="warning">Select at least one role.</Alert>}
        {Boolean(error) && <Alert tone="danger">{friendlySaveError(error)}</Alert>}
      </div>
    </Dialog>
  );
}
