import { useAccessibleModules } from '@/core/modules/ModuleRegistryContext';

/** Navigation entries = registered modules the user can access and that opt into the nav. */
export function useNavItems() {
  return useAccessibleModules().filter((module) => module.showInNav);
}
