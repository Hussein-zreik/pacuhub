import { ArrowRight, CalendarPlus, ExternalLink, Moon, ShieldCheck, Sun, UserRoundCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Badge, Card, buttonVariants } from '@/components/ui';
import { accessLabel } from '@/config/accessPresets';
import { env } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import { useAccessibleModules, usePermissionCatalog } from '@/core/modules/ModuleRegistryContext';
import { summarizeAccess } from '@/core/permissions/catalog';
import { usePermissions } from '@/core/permissions/usePermissions';
import type { AccessMap } from '@/core/permissions/types';
import { useClock } from '@/hooks/useClock';
import { currentShift, firstNameOf, greeting } from './dashboard';
import { usePendingApprovals, useRequestLink } from './hooks/useDashboardData';

const NO_ACCESS: AccessMap = {};

export default function HomePage() {
  const { state } = useAuth();
  const { can, isAdmin } = usePermissions();
  const catalog = usePermissionCatalog();
  const now = useClock(60_000);

  const user = state.status === 'authorized' ? state.user : null;
  const access = state.status === 'authorized' ? state.access : NO_ACCESS;
  const modules = useAccessibleModules().filter((module) => module.showInNav && module.id !== 'home');
  const summary = new Map(summarizeAccess(access, catalog).map((item) => [item.moduleId, item.detail]));
  const firstName = firstNameOf(user?.displayName, user?.email);

  const canSchedule = can('schedule', 'view');
  const { count: pending } = usePendingApprovals(isAdmin);
  const requestLink = useRequestLink(canSchedule);
  const shift = currentShift(now);
  const ShiftIcon = shift.id === 'day' ? Sun : Moon;

  return (
    <div className="space-y-6">
      {/* Today strip */}
      <section className="overflow-hidden rounded-card border border-brand-100 bg-gradient-to-r from-brand-50 via-surface to-surface p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
              {greeting(now.getHours())}
              {firstName ? `, ${firstName}` : ''}
            </h2>
            <p className="mt-1 text-ink-muted">
              {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <div className="mt-3">
              <Badge tone="brand">{accessLabel(access, catalog)}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start rounded-xl border border-line bg-surface px-4 py-3 shadow-sm">
            <ShiftIcon className={`size-6 ${shift.id === 'day' ? 'text-warning-600' : 'text-brand-600'}`} aria-hidden="true" />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-ink">{shift.label}</p>
              <p className="text-xs text-ink-muted">{shift.id === 'day' ? '07:00 – 19:00' : '19:00 – 07:00'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Admin: pending approvals */}
      {isAdmin && pending > 0 && (
        <Link to="/staff-access" className="block rounded-card">
          <Card className="flex items-center gap-4 border-warning-600/30 bg-warning-50 p-5 transition-shadow hover:shadow-raised">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-warning-600/15 text-warning-700">
              <UserRoundCheck className="size-6" />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-warning-700">
                {pending} {pending === 1 ? 'person is' : 'people are'} waiting for approval
              </p>
              <p className="text-sm text-warning-700/80">Review and grant their access in Staff Access.</p>
            </div>
            <ArrowRight className="size-5 text-warning-700" aria-hidden="true" />
          </Card>
        </Link>
      )}

      {/* Quick action: request a day off */}
      {canSchedule && requestLink && (
        <Card className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <CalendarPlus className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-ink">Need time off?</p>
              <p className="text-sm text-ink-muted">Send a day-off request to the Nurse Manager.</p>
            </div>
          </div>
          <a href={requestLink} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'secondary' })}>
            Request a day off <ExternalLink />
          </a>
        </Card>
      )}

      {/* Your tabs */}
      <section aria-labelledby="modules-heading">
        <h3 id="modules-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Your tabs
        </h3>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map(({ id, path, label, description, icon: Icon, status }) => (
            <li key={id}>
              <Link to={`/${path}`} className="group block h-full rounded-card">
                <Card className="flex h-full flex-col p-5 transition-shadow group-hover:shadow-raised">
                  <div className="flex items-start justify-between">
                    <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <Icon className="size-6" />
                    </span>
                    {status === 'planned' && <Badge>Coming soon</Badge>}
                    {status === 'preview' && <Badge tone="warning">Preview</Badge>}
                  </div>
                  <p className="mt-4 text-lg font-semibold text-ink">{label}</p>
                  <p className="mt-1 flex-1 text-sm text-ink-muted">{description}</p>
                  {summary.get(id) && <p className="mt-3 text-xs font-semibold text-brand-700">Your access: {summary.get(id)}</p>}
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                    Open <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="flex items-center gap-2 text-xs text-ink-subtle">
        <ShieldCheck className="size-4" aria-hidden="true" />
        For patient privacy, you'll be signed out after {Math.round(env.idleTimeoutMs / 60_000)} minutes of inactivity.
      </p>
    </div>
  );
}
