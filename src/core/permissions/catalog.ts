/**
 * Permission catalog — built from the module registry, so a new module's
 * access options appear in Staff Access automatically.
 */
import type { HubModuleDefinition } from '@/core/modules/types';
import { ADMIN_AREA, ADMIN_LEVEL, NO_ACCESS, type AccessMap, type PermissionArea } from './types';

export interface PermissionCatalog {
  areas: readonly PermissionArea[];
  byKey: ReadonlyMap<string, PermissionArea>;
  /** Areas grouped by module id, in registry order. */
  byModule: ReadonlyMap<string, readonly PermissionArea[]>;
}

export const areaKey = (moduleId: string, areaId?: string) => (areaId ? `${moduleId}:${areaId}` : moduleId);

export function areasOf(module: Pick<HubModuleDefinition, 'id' | 'label' | 'permissions'>): PermissionArea[] {
  const permissions = module.permissions;
  if (!permissions) return [];
  if (!permissions.areas?.length) {
    return [{ key: module.id, moduleId: module.id, moduleLabel: module.label, label: module.label, levels: permissions.levels }];
  }
  return permissions.areas.map((area) => ({
    key: areaKey(module.id, area.id),
    moduleId: module.id,
    moduleLabel: module.label,
    label: area.label,
    description: area.description,
    levels: permissions.levels,
  }));
}

export function buildCatalog(modules: readonly Pick<HubModuleDefinition, 'id' | 'label' | 'permissions'>[]): PermissionCatalog {
  const areas = modules.flatMap(areasOf);
  const byModule = new Map<string, PermissionArea[]>();
  for (const area of areas) byModule.set(area.moduleId, [...(byModule.get(area.moduleId) ?? []), area]);
  return { areas, byKey: new Map(areas.map((a) => [a.key, a])), byModule };
}

/** 0 = no access; 1..n = position in the area's levels (higher includes lower). */
export function levelRank(area: PermissionArea | undefined, levelId: string | undefined): number {
  if (!area || !levelId || levelId === NO_ACCESS) return 0;
  return area.levels.findIndex((level) => level.id === levelId) + 1;
}

/** Does the person hold at least `minLevel` in `key`? Unknown keys/levels → false. */
export function hasLevel(access: AccessMap, catalog: PermissionCatalog, key: string, minLevel: string): boolean {
  const area = catalog.byKey.get(key);
  const required = levelRank(area, minLevel);
  return required > 0 && levelRank(area, access[key]) >= required;
}

/** A module without declared permissions (e.g. Home) is open to every approved user. */
export function canOpenModule(module: Pick<HubModuleDefinition, 'id' | 'label' | 'permissions'>, access: AccessMap): boolean {
  const areas = areasOf(module);
  if (areas.length === 0) return true;
  return areas.some((area) => levelRank(area, access[area.key]) > 0);
}

export const isAdmin = (access: AccessMap) => access[ADMIN_AREA] === ADMIN_LEVEL;

/**
 * Cleans an untrusted access map: keeps string values, drops "none"/blank.
 * With a catalog, also drops keys and levels that don't exist (fail closed).
 */
export function sanitizeAccess(raw: unknown, catalog?: PermissionCatalog): AccessMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'string' || !value || value === NO_ACCESS) continue;
    if (catalog && levelRank(catalog.byKey.get(key), value) === 0) continue;
    clean[key] = value;
  }
  return clean;
}

export const hasAnyAccess = (access: AccessMap) => Object.keys(access).length > 0;

/** Order-independent equality. */
export function sameAccess(a: AccessMap, b: AccessMap): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

export interface AccessSummaryItem {
  moduleId: string;
  moduleLabel: string;
  /** e.g. "Fill & review", "Enter & view · all types", "2 of 3 types" */
  detail: string;
}

/** Human-readable, per-module summary of what someone can do. */
export function summarizeAccess(access: AccessMap, catalog: PermissionCatalog): AccessSummaryItem[] {
  const items: AccessSummaryItem[] = [];
  for (const [moduleId, areas] of catalog.byModule) {
    const granted = areas.filter((area) => levelRank(area, access[area.key]) > 0);
    if (granted.length === 0) continue;
    const first = granted[0]!;
    const levelLabel = (key: string) => first.levels.find((l) => l.id === access[key])?.label ?? '';
    let detail: string;
    if (areas.length === 1) {
      detail = levelLabel(first.key);
    } else {
      const sameLevel = granted.every((area) => access[area.key] === access[first.key]);
      const scope = granted.length === areas.length ? 'all types' : `${granted.length} of ${areas.length} types`;
      detail = sameLevel ? `${levelLabel(first.key)} · ${scope}` : scope;
    }
    items.push({ moduleId, moduleLabel: first.moduleLabel, detail });
  }
  return items;
}
