/**
 * Exposes the registry through context (instead of a direct import) so that
 * features like Home can list other modules without importing them, and
 * tests can inject a fake registry.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { usePermissions } from '@/context/AuthContext';
import type { RegisteredModule } from './types';

const ModuleRegistryContext = createContext<readonly RegisteredModule[] | null>(null);

export function ModuleRegistryProvider({ modules, children }: { modules: readonly RegisteredModule[]; children: ReactNode }) {
  return <ModuleRegistryContext.Provider value={modules}>{children}</ModuleRegistryContext.Provider>;
}

export function useModuleRegistry(): readonly RegisteredModule[] {
  const modules = useContext(ModuleRegistryContext);
  if (!modules) throw new Error('useModuleRegistry must be used inside <ModuleRegistryProvider>.');
  return modules;
}

/** Modules the current user may open, in navigation order. */
export function useAccessibleModules(): RegisteredModule[] {
  const modules = useModuleRegistry();
  const { can } = usePermissions();
  return useMemo(() => modules.filter((module) => can(module.requires)), [modules, can]);
}
