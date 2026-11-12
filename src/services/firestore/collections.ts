/**
 * Firestore collection names. These MUST match the paths in firestore.rules —
 * which is why they're constants, not environment variables.
 *
 * Every PACU Hub collection is prefixed `pacuhub_` because the Firebase
 * project is shared with SNV2: the prefix guarantees PACU Hub can never read,
 * overwrite or collide with SNV2's data (e.g. an existing `users` collection).
 */
export const COLLECTIONS = {
  users: 'pacuhub_users',
} as const;
