/**
 * Settings: everyone gets "My preferences"; admins also get "Unit" and
 * "Activity log". The tabs are a convenience — firestore.rules enforce who can
 * read and write each document.
 */
import { History, SlidersHorizontal, UserRound } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/ui';
import { usePermissions } from '@/core/permissions/usePermissions';
import { cn } from '@/utils/cn';
import { ActivityLog } from './components/ActivityLog';
import { PersonalSettings } from './components/PersonalSettings';
import { UnitSettings } from './components/UnitSettings';

type Tab = 'personal' | 'unit' | 'activity';

const TABS = [
  { id: 'personal', label: 'My preferences', Icon: UserRound, admin: false },
  { id: 'unit', label: 'Unit', Icon: SlidersHorizontal, admin: true },
  { id: 'activity', label: 'Activity log', Icon: History, admin: true },
] as const;

export default function SettingsModule() {
  const { isAdmin } = usePermissions();
  const [tab, setTab] = useState<Tab>('personal');
  const visible = TABS.filter((t) => !t.admin || isAdmin);
  const active: Tab = visible.some((t) => t.id === tab) ? tab : 'personal';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description={isAdmin ? 'Your own preferences, plus unit-wide settings and the activity log.' : 'Your display and sign-out preferences on this account.'}
      />

      {visible.length > 1 && (
        <div role="tablist" aria-label="Settings sections" className="inline-flex flex-wrap rounded-lg border border-line bg-surface p-1 shadow-sm">
          {visible.map(({ id, label, Icon }) => (
            <button
              key={id}
              role="tab"
              id={`settings-tab-${id}`}
              aria-selected={active === id}
              aria-controls="settings-panel"
              onClick={() => setTab(id)}
              className={cn(
                'flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors',
                active === id ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-brand-50 hover:text-ink',
              )}
            >
              <Icon className="size-4" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      )}

      <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${active}`} className="max-w-3xl">
        {active === 'personal' && <PersonalSettings />}
        {active === 'unit' && <UnitSettings />}
        {active === 'activity' && <ActivityLog />}
      </div>
    </div>
  );
}
