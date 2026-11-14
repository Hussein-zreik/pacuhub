/** Phone-width navigation (below `md`). Same registry source as the sidebar. */
import { NavLink } from 'react-router';
import { cn } from '@/utils/cn';
import { useNavItems } from './navItems';

export function BottomNav() {
  const items = useNavItems().slice(0, 5);
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="flex">
        {items.map(({ id, path, label, icon: Icon }) => (
          <li key={id} className="flex-1">
            <NavLink
              to={`/${path}`}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-semibold',
                  isActive ? 'text-accent' : 'text-ink-muted',
                )
              }
            >
              <Icon className="size-5" />
              <span className="max-w-full truncate px-1">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
