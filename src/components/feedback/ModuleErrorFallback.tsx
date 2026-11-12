import { RefreshCw, WifiOff, TriangleAlert } from 'lucide-react';
import { Button, Card, EmptyState } from '@/components/ui';
import { isChunkLoadError } from '@/utils/errors';
import type { FallbackProps } from './ErrorBoundary';

/** Shown in place of a crashed module. The rest of the Hub keeps working. */
export function ModuleErrorFallback({ error, errorId, reset, moduleLabel }: FallbackProps & { moduleLabel: string }) {
  const chunkFailed = isChunkLoadError(error);

  return (
    <Card>
      <EmptyState
        icon={chunkFailed ? WifiOff : TriangleAlert}
        title={chunkFailed ? `${moduleLabel} couldn't be loaded` : `${moduleLabel} ran into a problem`}
        description={
          <>
            <p>
              {chunkFailed
                ? 'Check the network connection, then reload. A new version of PACU Hub may also have been released.'
                : 'The rest of PACU Hub is working normally. You can try again or switch to another tab.'}
            </p>
            <p className="mt-3 text-xs text-ink-subtle">
              Reference: <span className="font-mono font-semibold">{errorId}</span> — quote this when contacting IT support.
            </p>
          </>
        }
        action={
          chunkFailed ? (
            <Button onClick={() => window.location.reload()}>
              <RefreshCw /> Reload page
            </Button>
          ) : (
            <Button onClick={reset}>
              <RefreshCw /> Try again
            </Button>
          )
        }
      />
    </Card>
  );
}
