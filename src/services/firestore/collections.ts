/**
 * Firestore collection names. These MUST match the paths in firestore.rules —
 * which is why they're constants, not environment variables.
 */
export const COLLECTIONS = {
  users: 'users',
} as const;
