import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Badge, Card } from '@/components/ui';
import { ROLE_LABELS } from '@/config/permissions';
import { env } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import { useAccessibleModules } from '@/core/modules/ModuleRegistryContext';

function greeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomePage() {
  const { state } = useAuth();
  const modules = useAccessibleModules().filter((module) => module.showInNav && module.id !== 'home');
  const user = state.status === 'authorized' ? state.user : null;
  const roles = state.status === 'authorized' ? state.roles : [];
  const firstName = user?.displayName?.split(' ')[0];

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-card border border-brand-100 bg-gradient-to-r from-brand-50 via-surface to-surface p-6 md:p-8">
        <h2 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
          {greeting(new Date().getHours())}
          {firstName ? `, ${firstName}` : ''}
        </h2>
        <p className="mt-1 text-ink-muted">What would you like to do?</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {roles.map((role) => (
            <Badge key={role} tone="brand">
              {ROLE_LABELS[role]}
            </Badge>
          ))}
        </div>
      </section>

      <section aria-labelledby="modules-heading">
        <h3 id="modules-heading" className="sr-only">
          Modules
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
