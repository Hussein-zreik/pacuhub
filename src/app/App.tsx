import { env } from '@/config/env';
import { logger } from '@/services/monitoring/logger';
import { AppProviders } from './providers/AppProviders';
import { AppRouter } from './router/AppRouter';
import { SetupRequiredPage } from './SetupRequiredPage';

if (env.warnings.length) logger.warn('Configuration warnings', { warnings: env.warnings });

export function App() {
  if (env.issues.length > 0 || !env.firebase) return <SetupRequiredPage issues={env.issues} />;
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
