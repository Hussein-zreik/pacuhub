/**
 * Server-state cache configuration (TanStack Query).
 *
 * - Bounded garbage collection keeps memory flat on workstations that stay
 *   open for an entire 12-hour shift.
 * - Permission errors are never retried (they won't succeed on retry).
 * - The cache is fully cleared on sign-out (see AuthContext).
 */
import { QueryClient } from '@tanstack/react-query';

const NON_RETRYABLE = new Set(['permission-denied', 'unauthenticated', 'not-found', 'invalid-argument']);

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          const code = (error as { code?: string }).code;
          return failureCount < 2 && !(code && NON_RETRYABLE.has(code));
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: { retry: 0 },
    },
  });
}
