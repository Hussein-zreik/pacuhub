import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { App } from '@/app/App';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { FullPageMessage } from '@/components/feedback/FullPageMessage';
import { Button } from '@/components/ui';
import { logger } from '@/services/monitoring/logger';
import '@/styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    {/* Last-resort boundary. Module-level boundaries catch almost everything first. */}
    <ErrorBoundary
      onError={(error, info, errorId) => logger.error('Fatal application error', error, { errorId, componentStack: info.componentStack })}
      fallback={({ errorId }) => (
        <FullPageMessage
          icon={TriangleAlert}
          title="PACU Hub needs to reload"
          actions={
            <Button onClick={() => window.location.reload()}>
              <RefreshCw /> Reload
            </Button>
          }
        >
          <p>Something unexpected happened. Reloading usually fixes it.</p>
          <p className="text-xs">
            Reference: <span className="font-mono font-semibold">{errorId}</span>
          </p>
        </FullPageMessage>
      )}
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
