/**
 * Templates: one click fills in a typical access set, which the admin can
 * then adjust for that person.
 *
 * Grants support wildcards so new tabs / audit types are covered without
 * editing this file:
 *   "audits:*" → every audit type
 *   "*"        → every area
 *   "max"      → the highest level of each matched area
 */
import { areaKey, levelRank, sameAccess, type PermissionCatalog } from '@/core/permissions/catalog';
import type { AccessMap } from '@/core/permissions/types';

export interface AccessPreset {
  id: string;
  label: string;
  description: string;
  grants: Readonly<Record<string, string>>;
}

export const ACCESS_PRESETS: readonly AccessPreset[] = [
  {
    id: 'staff-nurse',
    label: 'Staff Nurse',
    description: 'Schedule and PACU forms.',
    grants: { schedule: 'view', forms: 'fill' },
  },
  {
    id: 'charge-nurse',
    label: 'Charge Nurse',
    description: 'Schedule, forms with review and co-sign.',
    grants: { schedule: 'view', forms: 'review' },
  },
  {
    id: 'educator',
    label: 'Educator / Auditor',
    description: 'Forms plus full access to every audit type.',
    grants: { schedule: 'view', forms: 'fill', 'audits:*': 'max' },
  },
  {
    id: 'nurse-manager',
    label: 'Nurse Manager / Admin',
    description: 'Everything, including managing staff access.',
    grants: { '*': 'max' },
  },
];

export function expandPreset(preset: AccessPreset, catalog: PermissionCatalog): AccessMap {
  const access: Record<string, string> = {};
  for (const [pattern, level] of Object.entries(preset.grants)) {
    const areas =
      pattern === '*'
        ? catalog.areas
        : pattern.endsWith(':*')
          ? (catalog.byModule.get(pattern.slice(0, -2)) ?? [])
          : [catalog.byKey.get(pattern) ?? catalog.byKey.get(areaKey(pattern))].filter((a) => a !== undefined);
    for (const area of areas) {
      const levelId = level === 'max' ? area.levels.at(-1)?.id : level;
      if (levelId && levelRank(area, levelId) > 0) access[area.key] = levelId;
    }
  }
  return access;
}

/** The template this access exactly matches, or null ("Custom"). */
export function matchPreset(access: AccessMap, catalog: PermissionCatalog): AccessPreset | null {
  return ACCESS_PRESETS.find((preset) => sameAccess(expandPreset(preset, catalog), access)) ?? null;
}

/** Template name when it matches exactly, otherwise "Custom access". */
export function accessLabel(access: AccessMap, catalog: PermissionCatalog): string {
  return matchPreset(access, catalog)?.label ?? 'Custom access';
}
