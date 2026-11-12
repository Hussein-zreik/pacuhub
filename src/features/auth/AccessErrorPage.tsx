/** Access could not be verified (usually connectivity). Retryable — never a lock-out. */
import { LogOut, RefreshCw, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { FullPageMessage } from '@/components/feedback/FullPageMessage';
import { Button } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function AccessErrorPage({ message }: { message: string }) {
  useDocumentTitle('Connection problem');
  const { signOut, refreshAccess } = useAuth();
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    try {
      await refreshAccess();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <FullPageMessage
      icon={WifiOff}
      title="We couldn't verify your access"
      actions={
        <>
          <Button variant="secondary" onClick={() => void signOut('user')}>
            <LogOut /> Sign out
          </Button>
          <Button onClick={() => void retry()} loading={retrying}>
            {!retrying && <RefreshCw />} Try again
          </Button>
        </>
      }
    >
      <p>{message}</p>
    </FullPageMessage>
  );
}
