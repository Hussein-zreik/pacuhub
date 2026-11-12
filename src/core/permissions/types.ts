/**
 * Per-person, per-tab access model.
 *
 * Every module (tab) declares the access LEVELS it supports, lowest → highest,
 * and optionally sub-AREAS (e.g. audit types) that each get their own level.
 * A staff member's access is a flat map: area key → level id.
 *
 *   {
 *     "schedule": "view",
 *     "audits:infection-control": "enter",
 *     "audits:brief-op-notes": "view",
 *     "staff-access": "admin"
 *   }
 *
 * A missing key means "no access". Unknown keys/levels grant nothing.
 */

export interface AccessLevelDef {
  /** Stored value, e.g. "enter". Must be stable once in use. */
  id: string;
  /** Shown to admins, e.g. "Enter & view". */
  label: string;
  description?: string;
}

export interface PermissionAreaDef {
  /** Stable id, kebab-case, e.g. "infection-control". */
  id: string;
  label: string;
  description?: string;
}

/** Declared by a module in its `module.ts`. */
export interface ModulePermissions {
  /** Levels from LOWEST to HIGHEST. Each level includes everything below it. "No access" is implicit. */
  levels: readonly AccessLevelDef[];
  /** Optional sub-areas, each with its own level (e.g. one per audit type). */
  areas?: readonly PermissionAreaDef[];
}

/** One assignable line in the access editor. */
export interface PermissionArea {
  /** "schedule" for a whole module, or "audits:infection-control" for a sub-area. */
  key: string;
  moduleId: string;
  moduleLabel: string;
  /** Sub-area label (or the module label when the module has no sub-areas). */
  label: string;
  description?: string;
  levels: readonly AccessLevelDef[];
}

/** area key → level id. Absent = no access. */
export type AccessMap = Readonly<Record<string, string>>;

export const NO_ACCESS = 'none';
export const ADMIN_AREA = 'staff-access';
export const ADMIN_LEVEL = 'admin';
