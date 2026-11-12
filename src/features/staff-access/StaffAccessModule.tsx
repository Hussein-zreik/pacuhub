/**
 * Staff Access (admin only): approve access requests, set per-tab access, and
 * deactivate/reactivate staff. Changes apply to the person's open sessions
 * within seconds via their live access subscription.
 */
import { Inbox, RefreshCw, Search, UserCheck, UserX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert, Button, Card, Dialog, EmptyState, Input, PageHeader, Skeleton } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { isAdmin } from '@/core/permissions/catalog';
import type { AccessChange, UserProfile } from '@/services/users/types';
import { cn } from '@/utils/cn';
import { AccessEditor, type AccessEditorMode } from './components/AccessEditor';
import { StaffRow, type StaffAction } from './components/StaffRow';
import { useStaffList, useUpdateAccess } from './hooks/useStaff';
import { FILTER_LABELS, countByStatus, filterStaff, friendlySaveError, type StaffFilter } from './logic';

type Pending = { person: UserProfile; action: StaffAction } | null;

const EMPTY: Record<StaffFilter, { icon: typeof Inbox; title: string; text: string }> = {
  pending: { icon: Inbox, title: 'No pending requests', text: 'New staff appear here after their first sign-in.' },
  active: { icon: UserCheck, title: 'No active staff', text: 'Approved staff will be listed here.' },
  disabled: { icon: UserX, title: 'No deactivated accounts', text: 'Deactivated staff keep their record here for the audit trail.' },
};

export default function StaffAccessModule() {
  const { state } = useAuth();
  const selfUid = state.status === 'authorized' ? state.user.uid : null;
  const staffQuery = useStaffList();
  const update = useUpdateAccess();

  const staff = useMemo(() => staffQuery.data ?? [], [staffQuery.data]);
  // Owner ("master") accounts are hidden from everyone except themselves.
  const listed = useMemo(() => staff.filter((p) => !p.owner || p.uid === selfUid), [staff, selfUid]);
  const counts = useMemo(() => countByStatus(listed), [listed]);
  // Admin count uses the FULL list (incl. hidden owners) so the "second admin"
  // warning is accurate even for an admin who can't see the owner.
  const adminCount = useMemo(() => staff.filter((p) => p.status === 'active' && isAdmin(p.access)).length, [staff]);
  const [filter, setFilter] = useState<StaffFilter | null>(null);
  const activeFilter: StaffFilter = filter ?? (counts.pending > 0 ? 'pending' : 'active');
  const [search, setSearch] = useState('');
  const visible = useMemo(() => filterStaff(listed, activeFilter, search), [listed, activeFilter, search]);
  const [pending, setPending] = useState<Pending>(null);

  const close = () => {
    setPending(null);
    update.reset();
  };
  const save = (person: UserProfile, change: AccessChange) => update.mutate({ uid: person.uid, change }, { onSuccess: close });

  return (
    <>
      <PageHeader
        title="Staff Access"
        description="Approve requests and choose exactly which tabs, and which audit types, each person can use."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void staffQuery.refetch()} loading={staffQuery.isFetching && !staffQuery.isLoading}>
            {!staffQuery.isFetching && <RefreshCw />} Refresh
          </Button>
        }
      />

      {staffQuery.isSuccess && adminCount < 2 && (
        <Alert tone="warning" title="Add a second admin" className="mb-4">
          PACU Hub has only one admin. Give a trusted colleague <span className="font-semibold">Staff Access: Admin</span> so someone
          can approve staff when you're away. Admins can't remove their own admin access.
        </Alert>
      )}

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div role="tablist" aria-label="Filter staff" className="inline-flex rounded-lg border border-line bg-surface p-1 shadow-sm">
          {(Object.keys(FILTER_LABELS) as StaffFilter[]).map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeFilter === key}
              onClick={() => setFilter(key)}
              className={cn(
                'flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors',
                activeFilter === key ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-brand-50 hover:text-ink',
              )}
            >
              {FILTER_LABELS[key]}
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs tabular-nums',
                  activeFilter === key ? 'bg-white/20' : key === 'pending' && counts.pending > 0 ? 'bg-warning-50 text-warning-700' : 'bg-canvas',
                )}
              >
                {counts[key]}
              </span>
            </button>
          ))}
        </div>
        <label className="relative md:w-72">
          <span className="sr-only">Search staff</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" className="pl-9" />
        </label>
      </div>

      <Card className="overflow-hidden">
        {staffQuery.isLoading ? (
          <ul className="divide-y divide-line" aria-label="Loading staff">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-4">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64 max-w-full" />
                </div>
              </li>
            ))}
          </ul>
        ) : staffQuery.isError ? (
          <EmptyState
            icon={RefreshCw}
            title="Couldn't load staff"
            description="Check the network connection and try again."
            action={<Button onClick={() => void staffQuery.refetch()}>Try again</Button>}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={EMPTY[activeFilter].icon}
            title={search ? 'No matches' : EMPTY[activeFilter].title}
            description={search ? `No ${FILTER_LABELS[activeFilter].toLowerCase()} match “${search}”.` : EMPTY[activeFilter].text}
          />
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((person) => (
              <StaffRow key={person.uid} person={person} isSelf={person.uid === selfUid} onAction={(action) => setPending({ person, action })} />
            ))}
          </ul>
        )}
      </Card>

      {pending && pending.action !== 'deactivate' && (
        <AccessEditor
          person={pending.person}
          mode={pending.action as AccessEditorMode}
          isSelf={pending.person.uid === selfUid}
          saving={update.isPending}
          error={update.error}
          onSubmit={(change) => save(pending.person, change)}
          onClose={close}
        />
      )}

      {pending?.action === 'deactivate' && (
        <Dialog
          open
          onOpenChange={(open) => !open && !update.isPending && close()}
          title="Deactivate access?"
          description={
            <>
              <span className="font-semibold text-ink">{pending.person.displayName ?? pending.person.email}</span> will be signed out of
              PACU Hub within seconds. Their record and access settings are kept so access can be restored later.
            </>
          }
          footer={
            <>
              <Button variant="secondary" onClick={close} disabled={update.isPending} data-autofocus>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={update.isPending}
                onClick={() => save(pending.person, { access: pending.person.access, status: 'disabled' })}
              >
                Deactivate
              </Button>
            </>
          }
        >
          {update.error ? <Alert tone="danger">{friendlySaveError(update.error)}</Alert> : null}
        </Dialog>
      )}
    </>
  );
}
