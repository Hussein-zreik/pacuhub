/** Shows the inactivity countdown and signs the user out when it expires. */
import { LogOut, ShieldCheck } from 'lucide-react';
import { useCallback } from 'react';
import { Button, Dialog } from '@/components/ui';
import { env } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';

const formatCountdown = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export function IdleSessionGuard() {
  const { state, signOut } = useAuth();
  const hasSession = state.status !== 'initializing' && state.status !== 'signedOut';

  const onTimeout = useCallback(() => void signOut('idle'), [signOut]);
  const { isWarning, remainingMs, stayActive } = useIdleTimeout({
    enabled: hasSession,
    timeoutMs: env.idleTimeoutMs,
    warningMs: env.idleWarningMs,
    onTimeout,
  });

  return (
    <Dialog
      open={hasSession && isWarning}
      dismissible={false}
      title="Are you still there?"
      description="To protect patient privacy on shared workstations, you'll be signed out automatically."
      footer={
        <>
          <Button variant="secondary" onClick={() => void signOut('user')}>
            <LogOut /> Sign out now
          </Button>
          <Button onClick={stayActive} data-autofocus>
            <ShieldCheck /> Stay signed in
          </Button>
        </>
      }
    >
      <p className="text-center text-4xl font-bold tabular-nums text-brand-700" aria-live="polite">
        {formatCountdown(remainingMs)}
      </p>
    </Dialog>
  );
}
