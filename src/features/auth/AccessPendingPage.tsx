/** Signed in with Google, but no PACU Hub role assigned yet. */
import { LogOut, RefreshCw, UserRoundX } from 'lucide-react';
import { useState } from 'react';
import { FullPageMessage } from '@/components/feedback/FullPageMessage';
import { Button } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { HubUser } from '@/services/auth/types';

export function AccessPendingPage({ user }: { user: HubUser }) {
  useDocumentTitle('Access pending');
  const { signOut, refreshAccess } = useAuth();
  const [checking, setChecking] = useState(false);

  const recheck = async () => {
    setChecking(true);
    try {
      await refreshAccess();
    } finally {
      setChecking(false);
    }
  };

  return (
    <FullPageMessage
      icon={UserRoundX}
      title="Access pending"
      actions={
        <>
          <Button variant="secondary" onClick={() => void signOut('user')}>
            <LogOut /> Use a different account
          </Button>
          <Button onClick={() => void recheck()} loading={checking}>
            {!checking && <RefreshCw />} Check again
          </Button>
        </>
      }
    >
      <p>
        You're signed in as <span className="font-semibold text-ink">{user.email}</span>, but this account hasn't been
        given access to PACU Hub yet.
      </p>
      <p>Ask your Nurse Manager to grant access, then select “Check again”.</p>
    </FullPageMessage>
  );
}
