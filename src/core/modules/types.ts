/**
 * The contract every PACU Hub module (tab) implements.
 *
 * To add a module, create `src/features/<name>/module.ts` that default-exports
 * `defineModule({...})`. It is discovered automatically — no core file, router
 * or navigation component needs to change. See docs/ADDING_A_MODULE.md.
 */
import type { ComponentType, LazyExoticComponent } from 'react';
import type { Capability } from '@/config/permissions';

export type ModuleStatus = 'live' | 'preview' | 'planned';

export interface HubModuleDefinition {
  /** Stable unique id (kebab-case). Used for keys, logging and error reports. */
  id: string;
  /** Navigation label — keep it to one or two words. */
  label: string;
  /** One-sentence description for the Home screen cards. */
  description: string;
  /** Any icon component accepting `className` (lucide-react icons fit). */
  icon: ComponentType<{ className?: string }>;
  /** URL segment (kebab-case, unique). The module owns everything under `/<path>/*`. */
  path: string;
  /** Sort order in navigation (ascending). */
  order: number;
  /** Capabilities the user must hold (ALL of them) to see and open this module. */
  requires?: Capability | readonly Capability[];
  /** `planned` modules show a "Soon" badge; useful while a module is being built. */
  status?: ModuleStatus;
  /** Set false for routes that should exist but not appear in the main nav. */
  showInNav?: boolean;
  /**
   * Lazy loader for the module's root component. Each module becomes its own
   * code-split chunk, so a module's size or a broken chunk never affects the
   * initial load of the Hub or any other module.
   */
  load: () => Promise<{ default: ComponentType }>;
}

export interface RegisteredModule extends Readonly<HubModuleDefinition> {
  status: ModuleStatus;
  showInNav: boolean;
  /** Created once at registration — never per render (avoids remount loops). */
  Component: LazyExoticComponent<ComponentType>;
}

/** Identity helper that gives module authors full type-checking and autocomplete. */
export const defineModule = (definition: HubModuleDefinition): HubModuleDefinition => definition;
