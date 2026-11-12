import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Badge, Card } from '@/components/ui';
import { accessLabel } from '@/config/accessPresets';
import { env } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import { useAccessibleModules, usePermissionCatalog } from '@/core/modules/ModuleRegistryContext';
import { summarizeAccess } from '@/core/permissions/catalog';
import type { AccessMap } from '@/core/permissions/types';

function greeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const NO_ACCESS: AccessMap = {};

export default function HomePage() {
  const { state } = useAuth();
  const catalog = usePermissionCatalog();
  const modules = useAccessibleModules().filter((module) => module.showInNav && module.id !== 'home');
  const user = state.status === 'authorized' ? state.user : null;
  const access = state.status === 'authorized' ? state.access : NO_ACCESS;
  const summary = new Map(summarizeAccess(access, catalog).map((item) => [item.moduleId, item.detail]));
  const firstName = user?.displayName?.split(' ')[0];

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-card border border-brand-100 bg-gradient-to-r from-brand-50 via-surface to-surface p-6 md:p-8">
        <h2 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
          {greeting(new Date().getHours())}
          {firstName ? `, ${firstName}` : ''}
        </h2>
        <p className="mt-1 text-ink-muted">What would you like to do?</p>
        <div className="mt-4">
          <Badge tone="brand">{accessLabel(access, catalog)}</Badge>
        </div>
      </section>

      <section aria-labelledby="modules-heading">
        <h3 id="modules-heading" className="sr-only">
          Your modules
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
