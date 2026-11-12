import { LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { BrandMark } from '@/components/brand/BrandMark';
import { Badge, Button } from '@/components/ui';
import { ROLE_LABELS } from '@/config/permissions';
import { useAuth } from '@/context/AuthContext';
import { useModuleRegistry } from '@/core/modules/ModuleRegistryContext';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/** Ticks once per minute — enough for a clock, negligible re-render cost. */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function initials(name: string | null, email: string | null) {
  const source = name?.trim() || email || '?';
  const parts = source.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase();
}

export function TopBar() {
  const { state, signOut } = useAuth();
  const modules = useModuleRegistry();
  const { pathname } = useLocation();
  const online = useOnlineStatus();
  const now = useClock();

  const current = modules.find((module) => pathname === `/${module.path}` || pathname.startsWith(`/${module.path}/`));
  const user = state.status === 'authorized' ? state.user : null;
  const primaryRole = state.status === 'authorized' ? state.roles.at(-1) : undefined; // highest privilege (ROLES is ordered)

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-line bg-surface/95 px-4 backdrop-blur md:px-8">
      <BrandMark compact className="md:hidden" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold text-ink">{current?.label ?? 'PACU Hub'}</h1>
        <p className="hidden text-xs text-ink-muted sm:block">
          {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ·{' '}
          {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      <Badge tone={online ? 'success' : 'warning'} className="hidden sm:inline-flex">
        <span className={`size-2 rounded-full ${online ? 'bg-success-600' : 'bg-warning-600'}`} aria-hidden="true" />
        {online ? 'Online' : 'Offline'}
      </Badge>

      {user && (
        <div className="flex items-center gap-3">
          <div className="hidden text-right leading-tight lg:block">
            <p className="text-sm font-semibold text-ink">{user.displayName ?? user.email}</p>
            {primaryRole && <p className="text-xs text-ink-muted">{ROLE_LABELS[primaryRole]}</p>}
          </div>
          {user.photoURL ? (
            <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="size-9 rounded-full border border-line" />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800" aria-hidden="true">
              {initials(user.displayName, user.email)}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={() => void signOut('user')} aria-label="Sign out">
            <LogOut />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      )}
    </header>
  );
}
