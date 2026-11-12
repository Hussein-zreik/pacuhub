import { CAPABILITIES, ROLES, ROLE_CAPABILITIES, type Capability, type Role } from '@/config/permissions';

const ROLE_SET: ReadonlySet<string> = new Set(ROLES);

/** "Charge Nurse", "charge-nurse", "CHARGE_NURSE" → "charge_nurse" */
const canonical = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, '_');

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLE_SET.has(value);
}

/**
 * Normalizes whatever role shape the backend stores into a de-duplicated
 * `Role[]`. Supports the common Firebase patterns:
 *   { role: "admin" } · { roles: ["educator", "charge_nurse"] } · { admin: true }
 * Unknown values are ignored — never guessed — so a malformed claim can only
 * ever *reduce* access, not grant it.
 */
export function normalizeRoles(source: Record<string, unknown> | null | undefined): Role[] {
  if (!source) return [];
  const found = new Set<Role>();

  const collect = (value: unknown) => {
    if (typeof value === 'string') {
      const candidate = canonical(value);
      if (isRole(candidate)) found.add(candidate);
    } else if (Array.isArray(value)) {
      value.forEach(collect);
    }
  };

  collect(source.role);
  collect(source.roles);
  for (const role of ROLES) {
    if (source[role] === true) found.add(role);
  }

  // Stable order (matches ROLES) so UI and tests are deterministic.
  return ROLES.filter((role) => found.has(role));
}

export function capabilitiesFor(roles: readonly Role[]): ReadonlySet<Capability> {
  const caps = new Set<Capability>();
  for (const role of roles) ROLE_CAPABILITIES[role].forEach((cap) => caps.add(cap));
  return caps;
}

export function hasAll(granted: ReadonlySet<Capability>, required: Capability | readonly Capability[] | undefined): boolean {
  if (!required) return true;
  const list = typeof required === 'string' ? [required] : required;
  return list.every((cap) => granted.has(cap));
}

export const ALL_CAPABILITIES = CAPABILITIES;
