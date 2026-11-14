/**
 * Per-person access editor: start from a template, then fine-tune the level
 * for every tab (and every audit type). Built entirely from the permission
 * catalog, so new tabs and audit types appear here automatically.
 */
import { CalendarDays, Check, Lock, X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Alert, Button, Dialog, SegmentedControl, Select, type SegmentOption } from '@/components/ui';
import { ACCESS_PRESETS, expandPreset, matchPreset } from '@/config/accessPresets';
import { useSettings } from '@/context/SettingsContext';
import { useModuleRegistry, usePermissionCatalog } from '@/core/modules/ModuleRegistryContext';
import { hasAnyAccess, sanitizeAccess } from '@/core/permissions/catalog';
import { ADMIN_AREA, ADMIN_LEVEL, NO_ACCESS, type AccessMap, type PermissionArea } from '@/core/permissions/types';
import { rosterPeople } from '@/services/roster/published';
import type { AccessChange, UserProfile } from '@/services/users/types';
import { usePublishedRosters } from '@/hooks/usePublishedRosters';
import { cn } from '@/utils/cn';
import { friendlySaveError } from '../logic';

export type AccessEditorMode = 'approve' | 'edit' | 'reactivate';

const COPY: Record<AccessEditorMode, { title: string; confirm: string }> = {
  approve: { title: 'Approve access request', confirm: 'Approve access' },
  edit: { title: 'Edit access', confirm: 'Save changes' },
  reactivate: { title: 'Reactivate access', confirm: 'Reactivate' },
};

export interface AccessEditorProps {
  person: UserProfile;
  mode: AccessEditorMode;
  /** Editing your own access: your admin level is locked on. */
  isSelf: boolean;
  saving: boolean;
  error: unknown;
  onSubmit: (change: AccessChange) => void;
  onClose: () => void;
}

const optionsFor = (area: PermissionArea): SegmentOption[] => [
  { value: NO_ACCESS, label: 'No access' },
  ...area.levels.map((level) => ({ value: level.id, label: level.label, description: level.description })),
];

export function AccessEditor({ person, mode, isSelf, saving, error, onSubmit, onClose }: AccessEditorProps) {
  const catalog = usePermissionCatalog();
  const modules = useModuleRegistry();
  const copy = COPY[mode];
  const { appSettings } = useSettings();

  const [access, setAccess] = useState<Record<string, string>>(() => {
    const existing = sanitizeAccess(person.access, catalog);
    if (hasAnyAccess(existing)) return { ...existing };
    // New requests start from the most common template; nothing is saved until confirmed.
    const preset = ACCESS_PRESETS.find((p) => p.id === appSettings.defaultTemplate) ?? ACCESS_PRESETS[0]!;
    return { ...expandPreset(preset, catalog) };
  });
  const [touched, setTouched] = useState(false);
  const [rosterId, setRosterId] = useState<string>(person.rosterId ?? '');
  const rosterSelectId = useId();
  const { rosters } = usePublishedRosters();
  const people = useMemo(() => rosterPeople(rosters ?? []), [rosters]);
  const groups = useMemo(() => [...new Set(people.map((p) => p.group))], [people]);

  const withSelfLock = (next: Record<string, string>) => (isSelf ? { ...next, [ADMIN_AREA]: ADMIN_LEVEL } : next);
  const setLevel = (key: string, level: string) =>
    setAccess((current) => {
      const next = { ...current };
      if (level === NO_ACCESS) delete next[key];
      else next[key] = level;
      return withSelfLock(next);
    });
  const setMany = (areas: readonly PermissionArea[], level: string) =>
    setAccess((current) => {
      const next = { ...current };
      for (const area of areas) {
        if (level === NO_ACCESS) delete next[area.key];
        else next[area.key] = level;
      }
      return withSelfLock(next);
    });

  const clean: AccessMap = useMemo(() => sanitizeAccess(access, catalog), [access, catalog]);
  const activePreset = matchPreset(clean, catalog);
  const invalid = !hasAnyAccess(clean);

  const submit = () => {
    setTouched(true);
    const link = rosterId || null;
    if (!invalid) onSubmit({ access: clean, status: 'active', ...(link !== person.rosterId ? { rosterId: link } : {}) });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !saving && onClose()}
      className="max-w-4xl"
      title={copy.title}
      description={
        <>
          <span className="font-semibold text-ink">{person.displayName ?? person.email}</span>
          {person.displayName && <> · {person.email}</>}
        </>
      }
      footer={
        <>
          {mode === 'approve' ? (
            <Button variant="secondary" disabled={saving} onClick={() => onSubmit({ access: {}, status: 'disabled' })}>
              <X /> Decline request
            </Button>
          ) : (
            <Button variant="secondary" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button onClick={submit} loading={saving} data-autofocus>
            {!saving && <Check />} {copy.confirm}
          </Button>
        </>
      }
    >
      {/* Templates */}
      <section aria-labelledby="templates-heading">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3 id="templates-heading" className="text-sm font-semibold text-ink">
            Start from a template
          </h3>
          <span className="text-xs text-ink-muted">
            Currently: <span className="font-semibold text-ink">{activePreset?.label ?? 'Custom'}</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {ACCESS_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.description}
              disabled={saving}
              onClick={() => setAccess(withSelfLock({ ...expandPreset(preset, catalog) }))}
              aria-pressed={activePreset?.id === preset.id}
              className={cn(
                'min-h-10 rounded-full border px-3.5 text-sm font-semibold transition-colors',
                activePreset?.id === preset.id
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-line bg-surface text-ink-muted hover:border-brand-300 hover:text-ink',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      {/* Per-tab access */}
      <section aria-labelledby="tabs-heading" className="mt-6">
        <h3 id="tabs-heading" className="mb-2 text-sm font-semibold text-ink">
          Access to each tab
        </h3>
        <div className="divide-y divide-line rounded-lg border border-line">
          {[...catalog.byModule].map(([moduleId, areas]) => {
            const module = modules.find((m) => m.id === moduleId);
            const Icon = module?.icon;
            const multi = areas.length > 1;
            return (
              <div key={moduleId} className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  {Icon && <Icon className="size-4 text-brand-600" />}
                  <p className="font-semibold text-ink">{areas[0]!.moduleLabel}</p>
                  {multi && <span className="text-xs text-ink-muted">· set each type separately</span>}
                </div>
                {areas.map((area) => {
                  const locked = isSelf && area.key === ADMIN_AREA;
                  const current = access[area.key] ?? NO_ACCESS;
                  const level = area.levels.find((l) => l.id === current);
                  return (
                    <div key={area.key} className={cn('flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-4', multi && 'md:pl-6')}>
                      <div className={cn('min-w-0 md:pt-2', multi && 'md:w-48 md:shrink-0')}>
                        {multi && <p className="text-sm font-medium text-ink">{area.label}</p>}
                        <p className="text-xs text-ink-muted">
                          {locked ? (
                            <span className="inline-flex items-center gap-1">
                              <Lock className="size-3" /> You can't remove your own admin access.
                            </span>
                          ) : (
                            (level?.description ?? (multi ? 'No access to this audit type.' : 'Tab hidden; no access to its data.'))
                          )}
                        </p>
                      </div>
                      <SegmentedControl
                        label={multi ? `${area.moduleLabel}: ${area.label}` : `Access to ${area.label}`}
                        value={current}
                        options={optionsFor(area)}
                        onChange={(value) => setLevel(area.key, value)}
                        disabled={saving || locked}
                      />
                    </div>
                  );
                })}
                {multi && (
                  <div className="flex flex-wrap items-center gap-2 md:pl-6">
                    <span className="text-xs text-ink-muted">Set all types:</span>
                    {optionsFor(areas[0]!).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        disabled={saving}
                        onClick={() => setMany(areas, option.value)}
                        className="rounded-md px-2 py-1 text-xs font-semibold text-accent hover:bg-brand-50"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Roster link */}
      <section aria-labelledby="roster-link-heading" className="mt-6">
        <h3 id="roster-link-heading" className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
          <CalendarDays className="size-4 text-brand-600" aria-hidden="true" /> Name on the published roster
        </h3>
        <p className="mb-2 text-xs text-ink-muted">Highlights this person's own row and shows their “My shifts” in Schedule.</p>
        {people.length === 0 && !person.rosterId ? (
          <p className="text-sm text-ink-muted">Names appear here once a fortnight is locked in SNV2 and published.</p>
        ) : (
          <Select
            id={rosterSelectId}
            aria-labelledby="roster-link-heading"
            value={rosterId}
            disabled={saving}
            onChange={(e) => setRosterId(e.target.value)}
            className="sm:max-w-sm"
          >
            <option value="">Not linked</option>
            {person.rosterId && !people.some((p) => p.id === person.rosterId) && (
              <option value={person.rosterId}>Current link (not on recent rosters)</option>
            )}
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {people
                  .filter((p) => p.group === g)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        )}
      </section>

      <div className="mt-3 space-y-2">
        {touched && invalid && <Alert tone="warning">Give access to at least one tab, or decline the request.</Alert>}
        {Boolean(error) && <Alert tone="danger">{friendlySaveError(error)}</Alert>}
      </div>
    </Dialog>
  );
}
