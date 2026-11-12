/**
 * Route gate for everything behind sign-in.
 * One branch per auth state — see the state machine in AuthContext.
 */
import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageLoader } from '@/components/feedback/FullPageLoader';
import { useAuth } from '@/context/AuthContext';
import { AccessErrorPage } from '@/features/auth/AccessErrorPage';
import { AccessPendingPage } from '@/features/auth/AccessPendingPage';
import { AppShell } from '@/app/layout/AppShell';

export function ProtectedLayout() {
  const { state } = useAuth();
  const location = useLocation();

  switch (state.status) {
    case 'initializing':
      return <FullPageLoader />;
    case 'resolving':
      return <FullPageLoader label="Verifying your access…" />;
    case 'signedOut':
      return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
    case 'unauthorized':
      return <AccessPendingPage user={state.user} />;
    case 'error':
      return <AccessErrorPage message={state.message} />;
    case 'authorized':
      return (
        <AppShell>
          <Outlet />
        </AppShell>
      );
  }
}

/** Login route gate: once a session exists, leave the login screen. */
export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'initializing') return <FullPageLoader />;
  if (state.status !== 'signedOut') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
  }
  return <>{children}</>;
}
