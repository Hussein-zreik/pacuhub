/**
 * Renders one registered module inside its own safety envelope:
 *   permission check → error boundary → suspense (skeleton while loading)
 *
 * This envelope is what guarantees module isolation: a crash, a slow chunk
 * download or a missing permission in one module is contained right here.
 */
import { Lock } from 'lucide-react';
import { Suspense } from 'react';
import { Link, useLocation } from 'react-router';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { ModuleErrorFallback } from '@/components/feedback/ModuleErrorFallback';
import { Button, Card, EmptyState, ModuleSkeleton } from '@/components/ui';
import { usePermissions } from '@/context/AuthContext';
import type { RegisteredModule } from '@/core/modules/types';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { logger } from '@/services/monitoring/logger';

export function ModuleHost({ module }: { module: RegisteredModule }) {
  const { can } = usePermissions();
  const { pathname } = useLocation();
  useDocumentTitle(module.label);

  if (!can(module.requires)) {
    return (
      <Card>
        <EmptyState
          icon={Lock}
          title={`You don't have access to ${module.label}`}
          description="If you need access for your role, contact your Nurse Manager."
          action={
            <Link to="/">
              <Button variant="secondary">Back to Home</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <ErrorBoundary
      resetKeys={[module.id, pathname]}
      onError={(error, info, errorId) =>
        logger.error('Module crashed', error, { module: module.id, errorId, componentStack: info.componentStack })
      }
      fallback={(props) => <ModuleErrorFallback {...props} moduleLabel={module.label} />}
    >
      <Suspense fallback={<ModuleSkeleton />}>
        <module.Component />
      </Suspense>
    </ErrorBoundary>
  );
}
