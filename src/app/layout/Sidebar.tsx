/**
 * Primary navigation, generated entirely from the module registry.
 * - `md` (tablets): compact icon rail with short labels
 * - `lg`+ (workstations): full-width sidebar
 */
import { NavLink } from 'react-router';
import { BrandMark } from '@/components/brand/BrandMark';
import { Badge } from '@/components/ui';
import { APP } from '@/config/app';
import { useSettings } from '@/context/SettingsContext';
import { cn } from '@/utils/cn';
import { useNavItems } from './navItems';

export function Sidebar() {
  const items = useNavItems();
  const idleMinutes = useSettings().idle.minutes;

  return (
    <aside className="sticky top-0 hidden h-dvh w-24 shrink-0 flex-col border-r border-line bg-surface md:flex lg:w-64">
      <div className="flex h-16 items-center justify-center border-b border-line px-4 lg:justify-start">
        <BrandMark compact className="lg:hidden" />
        <BrandMark className="hidden lg:flex" subtitle={`${APP.institution} · PACU`} />
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {items.map(({ id, path, label, icon: Icon, status }) => (
            <li key={id}>
              <NavLink
                to={`/${path}`}
                className={({ isActive }) =>
                  cn(
                    'group relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm',
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-muted hover:bg-brand-50/60 hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand-600" aria-hidden="true" />}
                    <Icon className="size-5 shrink-0" />
                    <span className="max-w-full text-center leading-tight lg:truncate lg:text-left">{label}</span>
                    {status === 'planned' && (
                      <Badge tone="neutral" className="ml-auto hidden lg:inline-flex">
                        Soon
                      </Badge>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <p className="hidden border-t border-line px-4 py-3 text-xs text-ink-subtle lg:block">
        Auto sign-out after {idleMinutes} min of inactivity.
      </p>
    </aside>
  );
}
