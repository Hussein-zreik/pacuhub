/**
 * Permission checks for the UI. Components ask WHAT the person can do, never
 * WHO they are:
 *
 *   const { can, levelOf } = usePermissions();
 *   can('audits:infection-control', 'enter')   // true / false
 *   levelOf('forms')                            // "fill" | "review" | null
 *
 * (Firestore Security Rules enforce the same access on the server.)
 */
import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { HubModuleDefinition } from '@/core/modules/types';
import { usePermissionCatalog } from '@/core/modules/ModuleRegistryContext';
import { canOpenModule, hasLevel, isAdmin } from './catalog';
import type { AccessMap } from './types';

const EMPTY: AccessMap = Object.freeze({});

export function usePermissions() {
  const { state } = useAuth();
  const catalog = usePermissionCatalog();
  const access = state.status === 'authorized' ? state.access : EMPTY;

  return useMemo(
    () => ({
      access,
      isAdmin: isAdmin(access),
      /** At least `minLevel` in `key` (e.g. "audits:brief-op-notes", "view"). */
      can: (key: string, minLevel: string) => hasLevel(access, catalog, key, minLevel),
      /** The person's level id in `key`, or null for no access. */
      levelOf: (key: string): string | null => {
        const level = access[key];
        return level && catalog.byKey.get(key)?.levels.some((l) => l.id === level) ? level : null;
      },
      canOpen: (module: Pick<HubModuleDefinition, 'id' | 'label' | 'permissions'>) => canOpenModule(module, access),
    }),
    [access, catalog],
  );
}
