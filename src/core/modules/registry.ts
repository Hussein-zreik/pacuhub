/**
 * Builds the immutable module registry from module definitions.
 *
 * Validation runs once at startup and fails loudly on developer mistakes
 * (duplicate ids/paths, malformed paths) so they are caught in development
 * and CI — never discovered by a nurse mid-shift.
 */
import { lazy } from 'react';
import type { Capability } from '@/config/permissions';
import { hasAll } from '@/utils/permissions';
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

export function accessibleModules(
  registry: readonly RegisteredModule[],
  granted: ReadonlySet<Capability>,
): RegisteredModule[] {
  return registry.filter((module) => hasAll(granted, module.requires));
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
