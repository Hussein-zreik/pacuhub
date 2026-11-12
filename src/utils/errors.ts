/** Errors thrown when a lazily-loaded module chunk can't be downloaded
 *  (network drop, or a new deploy replaced the old file). */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'ChunkLoadError' ||
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
      error.message,
    )
  );
}

/** Short reference id staff can read to IT when reporting an error. */
export function createErrorId(): string {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  const time = Date.now().toString(36).slice(-4).toUpperCase();
  return `PH-${time}${random}`;
}
