/**
 * Static, non-environment application constants.
 * Branding copy lives here so it can be changed in one place.
 */
export const APP = {
  name: 'PACU Hub',
  institution: 'AUBMC',
  unit: 'Post-Anesthesia Care Unit',
  tagline: 'The digital workspace for PACU nurses and unit leadership.',
  /** localStorage namespace — keeps keys from colliding with other apps on the same origin. */
  storagePrefix: 'pacuhub',
} as const;

export const storageKey = (key: string) => `${APP.storagePrefix}:${key}`;
