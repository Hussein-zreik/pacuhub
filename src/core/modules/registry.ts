/**
 * Builds the immutable module registry from module definitions.
 *
 * Validation runs once at startup and fails loudly on developer mistakes
 * (duplicate ids/paths, malformed paths) so they are caught in development
 * and CI — never discovered by a nurse mid-shift.
 */
import { lazy } from 'react';
import { canOpenModule } from '@/core/permissions/catalog';
import { NO_ACCESS, type AccessMap } from '@/core/permissions/types';
import type { HubModuleDefinition, RegisteredModule } from './types';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_PATHS = new Set(['login', 'access-pending', 'logout']);

export class ModuleRegistryError extends Error {
  constructor(message: string) {
    super(`[Module registry] ${message}`);
    this.name = 'ModuleRegistryError';
  }
}

export function buildRegistry(definitions: readonly HubModuleDefinition[]): readonly RegisteredModule[] {
  const ids = new Set<string>();
  const paths = new Set<string>();

  for (const def of definitions) {
    if (!SLUG.test(def.id)) throw new ModuleRegistryError(`Invalid id "${def.id}" — use kebab-case.`);
    if (!SLUG.test(def.path)) throw new ModuleRegistryError(`Invalid path "${def.path}" in "${def.id}" — use kebab-case.`);
    if (RESERVED_PATHS.has(def.path)) throw new ModuleRegistryError(`Path "${def.path}" in "${def.id}" is reserved.`);
    if (ids.has(def.id)) throw new ModuleRegistryError(`Duplicate module id "${def.id}".`);
    if (paths.has(def.path)) throw new ModuleRegistryError(`Duplicate module path "${def.path}" (module "${def.id}").`);
    ids.add(def.id);
    paths.add(def.path);
    validatePermissions(def);
  }

  return Object.freeze(
    [...definitions]
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
      .map(
        (def): RegisteredModule =>
          Object.freeze({
            ...def,
            status: def.status ?? 'live',
            showInNav: def.showInNav ?? true,
            Component: lazy(def.load),
          }),
      ),
  );
}

function validatePermissions(def: HubModuleDefinition) {
  const permissions = def.permissions;
  if (!permissions) return;
  if (permissions.levels.length === 0) throw new ModuleRegistryError(`"${def.id}" declares permissions with no levels.`);
  const levelIds = new Set<string>();
  for (const level of permissions.levels) {
    if (!SLUG.test(level.id) || level.id === NO_ACCESS) throw new ModuleRegistryError(`Invalid level "${level.id}" in "${def.id}".`);
    if (levelIds.has(level.id)) throw new ModuleRegistryError(`Duplicate level "${level.id}" in "${def.id}".`);
    levelIds.add(level.id);
  }
  const areaIds = new Set<string>();
  for (const area of permissions.areas ?? []) {
    if (!SLUG.test(area.id)) throw new ModuleRegistryError(`Invalid area "${area.id}" in "${def.id}".`);
    if (areaIds.has(area.id)) throw new ModuleRegistryError(`Duplicate area "${area.id}" in "${def.id}".`);
    areaIds.add(area.id);
  }
}

export function accessibleModules(registry: readonly RegisteredModule[], access: AccessMap): RegisteredModule[] {
  return registry.filter((module) => canOpenModule(module, access));
}

/**
 * Converts Vite's `import.meta.glob` result into definitions. Each module file
 * must default-export a definition; anything else is a developer error.
 */
export function definitionsFromGlob(files: Record<string, unknown>): HubModuleDefinition[] {
  return Object.entries(files).map(([file, exports]) => {
    const def = (exports as { default?: HubModuleDefinition }).default;
    if (!def || typeof def.load !== 'function') {
      throw new ModuleRegistryError(`${file} must \`export default defineModule({...})\`.`);
    }
    return def;
  });
}
