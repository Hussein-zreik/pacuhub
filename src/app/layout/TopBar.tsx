import { LogOut } from 'lucide-react';
import { useLocation } from 'react-router';
import { useClock } from '@/hooks/useClock';
import { BrandMark } from '@/components/brand/BrandMark';
import { Avatar, Badge, Button } from '@/components/ui';
import { accessLabel } from '@/config/accessPresets';
import { useAuth } from '@/context/AuthContext';
import { useModuleRegistry, usePermissionCatalog } from '@/core/modules/ModuleRegistryContext';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function TopBar() {
  const { state, signOut } = useAuth();
  const modules = useModuleRegistry();
  const catalog = usePermissionCatalog();
  const { pathname } = useLocation();
  const online = useOnlineStatus();
  const now = useClock();

  const current = modules.find((module) => pathname === `/${module.path}` || pathname.startsWith(`/${module.path}/`));
  const user = state.status === 'authorized' ? state.user : null;
  const accessName = state.status === 'authorized' ? accessLabel(state.access, catalog) : null;

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
            {accessName && <p className="text-xs text-ink-muted">{accessName}</p>}
          </div>
          <Avatar name={user.displayName} email={user.email} photoURL={user.photoURL} />
          <Button variant="ghost" size="sm" onClick={() => void signOut('user')} aria-label="Sign out">
            <LogOut />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      )}
    </header>
  );
}
