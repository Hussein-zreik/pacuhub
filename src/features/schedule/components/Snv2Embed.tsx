/**
 * Embedded SNV2 view.
 *
 * Security: the iframe is sandboxed to the minimum SNV2 needs, sends no full
 * referrer, and is granted no device permissions (camera, mic, location).
 *
 * Resilience: browsers don't report *why* a frame failed (e.g. SNV2 refusing
 * to be framed), so we always offer "Open in new tab" and surface a hint if
 * loading takes unusually long.
 */
import { ExternalLink, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, Button, PageHeader, Skeleton, buttonVariants } from '@/components/ui';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const SLOW_LOAD_MS = 15_000;

export function Snv2Embed({ url }: { url: string }) {
  const online = useOnlineStatus();
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setSlow(false);
    const timer = window.setTimeout(() => setSlow(true), SLOW_LOAD_MS);
    return () => window.clearTimeout(timer);
  }, [reloadKey]);

  return (
    <div className="flex h-[calc(100dvh-10rem)] min-h-[32rem] flex-col">
      <PageHeader
        title="Schedule"
        description="Unit staffing schedule (SNV2)."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setReloadKey((key) => key + 1)}>
              <RefreshCw /> Reload
            </Button>
            <a href={url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              Open in new tab <ExternalLink />
            </a>
          </>
        }
      />

      {!online && (
        <Alert tone="warning" className="mb-4">
          You're offline — the schedule may not load or may be out of date.
        </Alert>
      )}
      {slow && !loaded && (
        <Alert tone="info" className="mb-4">
          The schedule is taking longer than usual. If it doesn't appear, use “Open in new tab”.
        </Alert>
      )}

      <div className="relative flex-1 overflow-hidden rounded-card border border-line bg-surface shadow-card">
        {!loaded && <Skeleton className="absolute inset-4" />}
        <iframe
          key={reloadKey}
          src={url}
          title="SNV2 Schedule"
          className="size-full"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
          referrerPolicy="strict-origin-when-cross-origin"
          allow=""
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  );
}
