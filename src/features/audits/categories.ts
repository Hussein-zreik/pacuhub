/**
 * Audit types. Each one is a separate access area in Staff Access, so a nurse
 * can be given, say, Infection Control but not Brief Op Notes.
 *
 * To add an audit type: add it here. It appears in Staff Access automatically.
 * Never change an existing `id` — it is stored in staff access records.
 */
export const AUDIT_CATEGORIES = [
  { id: 'brief-op-notes', label: 'Brief Op Notes', description: 'Documentation completeness and timeliness.' },
  { id: 'staff-education', label: 'Staff Education', description: 'Certifications, competencies and in-services.' },
  { id: 'infection-control', label: 'Infection Control & Safety', description: 'Observational and environmental audits.' },
] as const;
