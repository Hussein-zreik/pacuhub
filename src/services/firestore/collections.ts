/**
 * Firestore collection names. These MUST match the paths in firestore.rules —
 * which is why they're constants, not environment variables.
 *
 * Every PACU Hub collection is prefixed `pacuhub_`. PACU Hub has its own
 * Firebase project, so this is belt-and-braces: names stay unambiguous even
 * if data is ever exported, merged or inspected alongside other apps.
 */
export const COLLECTIONS = {
  users: 'pacuhub_users',
} as const;
