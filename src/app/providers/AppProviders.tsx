/** Composition root for global providers. Order matters: outer → inner. */
import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { BrowserRouter } from 'react-router';
import { AuthProvider } from '@/context/AuthContext';
import { ModuleRegistryProvider } from '@/core/modules/ModuleRegistryContext';
import { moduleRegistry } from '@/core/modules/discovered';
import { IdleSessionGuard } from '@/app/session/IdleSessionGuard';
import { createQueryClient } from './queryClient';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ModuleRegistryProvider modules={moduleRegistry}>
            {children}
            <IdleSessionGuard />
          </ModuleRegistryProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
