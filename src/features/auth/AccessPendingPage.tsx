/**
 * Signed in with Google, but not (or no longer) granted PACU Hub access.
 * This screen updates by itself: the moment an admin approves the request,
 * the live access subscription moves the user into the Hub.
 */
import { Clock3, LogOut, RefreshCw, UserRoundX } from 'lucide-react';
import { useState } from 'react';
import { FullPageMessage } from '@/components/feedback/FullPageMessage';
import { Button } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { HubUser } from '@/services/auth/types';

export function AccessPendingPage({ user, access }: { user: HubUser; access: 'pending' | 'disabled' }) {
  const disabled = access === 'disabled';
  useDocumentTitle(disabled ? 'Access deactivated' : 'Access pending');
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

  const signedInAs = (
    <p>
      Signed in as <span className="font-semibold text-ink">{user.email}</span>.
    </p>
  );

  if (disabled) {
    return (
      <FullPageMessage
        icon={UserRoundX}
        title="Access deactivated"
        actions={
          <Button variant="secondary" onClick={() => void signOut('user')}>
            <LogOut /> Sign out
          </Button>
        }
      >
        {signedInAs}
        <p>Your PACU Hub access has been deactivated. If you believe this is a mistake, contact your Nurse Manager.</p>
      </FullPageMessage>
    );
  }

  return (
    <FullPageMessage
      icon={Clock3}
      title="Access request sent"
      actions={
        <>
          <Button variant="secondary" onClick={() => void signOut('user')}>
            <LogOut /> Use a different account
          </Button>
          <Button variant="ghost" onClick={() => void recheck()} loading={checking}>
            {!checking && <RefreshCw />} Check again
          </Button>
        </>
      }
    >
      {signedInAs}
      <p>Your request has been sent to the PACU Nurse Manager for approval.</p>
      <p>This page will open PACU Hub automatically as soon as access is granted — you can leave it open.</p>
    </FullPageMessage>
  );
}
