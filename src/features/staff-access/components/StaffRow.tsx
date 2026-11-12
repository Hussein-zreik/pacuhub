/**
 * One staff member. Layout adapts to the screen:
 *   - phones: stacked
 *   - tablets / small laptops: identity + roles on two lines, actions on the right
 *   - wide workstations (xl): aligned columns
 */
import { Avatar, Badge, Button } from '@/components/ui';
import { ROLE_LABELS } from '@/config/permissions';
import type { UserProfile } from '@/services/users/types';
import { formatDate, formatDateTime } from '@/utils/format';

export type StaffAction = 'approve' | 'edit' | 'deactivate' | 'reactivate';

function Roles({ person }: { person: UserProfile }) {
  if (person.roles.length === 0) return <span className="text-xs text-ink-subtle">No roles</span>;
  return (
    <>
      {person.roles.map((role) => (
        <Badge key={role} tone={person.status === 'active' ? 'brand' : 'neutral'}>
          {ROLE_LABELS[role]}
        </Badge>
      ))}
    </>
  );
}

const meta = (person: UserProfile) =>
  person.status === 'pending' ? `Requested ${formatDate(person.createdAt)}` : `Last sign-in ${formatDateTime(person.lastSignInAt)}`;

export function StaffRow({ person, isSelf, onAction }: { person: UserProfile; isSelf: boolean; onAction: (action: StaffAction) => void }) {
  return (
    <li className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:gap-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={person.displayName} email={person.email} photoURL={person.photoURL} className="size-10" />
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold text-ink">
            <span className="truncate">{person.displayName ?? person.email}</span>
            {isSelf && <Badge tone="brand">You</Badge>}
          </p>
          <p className="truncate text-sm text-ink-muted">{person.email}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 xl:hidden">
            <Roles person={person} />
            <span className="text-xs text-ink-muted">· {meta(person)}</span>
          </div>
        </div>
      </div>

      <div className="hidden w-60 flex-wrap gap-1.5 xl:flex">
        <Roles person={person} />
      </div>
      <p className="hidden w-36 text-xs text-ink-muted xl:block">{meta(person)}</p>

      <div className="flex shrink-0 gap-2 lg:w-52 lg:justify-end">
        {isSelf ? (
          <p className="text-xs text-ink-subtle lg:text-right">Another admin must change your access.</p>
        ) : person.status === 'pending' ? (
          <Button size="sm" onClick={() => onAction('approve')}>
            Review request
          </Button>
        ) : person.status === 'active' ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => onAction('edit')}>
              Edit roles
            </Button>
            <Button size="sm" variant="ghost" className="text-danger-700 hover:bg-danger-50 hover:text-danger-700" onClick={() => onAction('deactivate')}>
              Deactivate
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => onAction('reactivate')}>
            Reactivate
          </Button>
        )}
      </div>
    </li>
  );
}
