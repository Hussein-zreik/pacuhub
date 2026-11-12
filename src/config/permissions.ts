/**
 * Role → capability matrix.
 *
 * ARCHITECTURAL DECISION: UI code never checks roles directly
 * (`if (role === 'admin')`). It checks *capabilities* (`can('audits.export')`).
 * When the unit changes who can do what, only this file changes — no
 * component is touched.
 *
 * NOTE: This client-side matrix controls what the UI *shows*. Real
 * enforcement must also exist in Firestore Security Rules.
 *
 * STATUS: provisional draft, pending confirmation of the role matrix
 * (discovery question B3).
 */

export const ROLES = ['staff_nurse', 'charge_nurse', 'educator', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  staff_nurse: 'Staff Nurse',
  charge_nurse: 'Charge Nurse',
  educator: 'Educator / Auditor',
  admin: 'Nurse Manager / Admin',
};

/** Plain-language summaries shown when an admin assigns roles. */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  staff_nurse: 'Schedule and PACU forms.',
  charge_nurse: 'Everything a staff nurse can do, plus reviewing and co-signing forms.',
  educator: 'Enters and reviews unit audits, education records and exports.',
  admin: 'Full access, including approving staff and assigning roles.',
};

export const CAPABILITIES = [
  'schedule.view',
  'forms.submit',
  'forms.viewAll',
  'forms.verify',
  'audits.enter',
  'audits.view',
  'audits.export',
  'admin.manage',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  staff_nurse: ['schedule.view', 'forms.submit'],
  charge_nurse: ['schedule.view', 'forms.submit', 'forms.viewAll', 'forms.verify'],
  educator: ['schedule.view', 'forms.submit', 'forms.viewAll', 'audits.enter', 'audits.view', 'audits.export'],
  admin: [...CAPABILITIES],
};
