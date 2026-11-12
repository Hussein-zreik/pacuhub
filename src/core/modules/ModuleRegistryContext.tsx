/**
 * Exposes the registry (and the permission catalog derived from it) through
 * context instead of a direct import, so features like Home and Staff Access
 * can list other modules without importing them, and tests can inject a fake
 * registry.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { buildCatalog, canOpenModule, type PermissionCatalog } from '@/core/permissions/catalog';
import type { RegisteredModule } from './types';

interface RegistryValue {
  modules: readonly RegisteredModule[];
  catalog: PermissionCatalog;
}

const ModuleRegistryContext = createContext<RegistryValue | null>(null);

export function ModuleRegistryProvider({ modules, children }: { modules: readonly RegisteredModule[]; children: ReactNode }) {
  const value = useMemo(() => ({ modules, catalog: buildCatalog(modules) }), [modules]);
  return <ModuleRegistryContext.Provider value={value}>{children}</ModuleRegistryContext.Provider>;
}

function useRegistryValue(): RegistryValue {
  const value = useContext(ModuleRegistryContext);
  if (!value) throw new Error('Module registry hooks must be used inside <ModuleRegistryProvider>.');
  return value;
}

export const useModuleRegistry = (): readonly RegisteredModule[] => useRegistryValue().modules;
export const usePermissionCatalog = (): PermissionCatalog => useRegistryValue().catalog;

/** Modules the current user may open, in navigation order. */
export function useAccessibleModules(): RegisteredModule[] {
  const { modules } = useRegistryValue();
  const { state } = useAuth();
  const access = state.status === 'authorized' ? state.access : null;
  return useMemo(() => (access ? modules.filter((module) => canOpenModule(module, access)) : []), [modules, access]);
}
