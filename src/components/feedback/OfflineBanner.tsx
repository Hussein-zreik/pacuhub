import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/** Persistent, non-blocking notice when the workstation loses connectivity. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="alert" className="flex items-center justify-center gap-2 bg-warning-600 px-4 py-2 text-sm font-semibold text-white">
      <WifiOff className="size-4" aria-hidden="true" />
      You are offline. Data may be out of date and changes cannot be saved until the connection returns.
    </div>
  );
}
