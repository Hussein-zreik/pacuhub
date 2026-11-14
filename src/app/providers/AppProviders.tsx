/** Composition root for global providers. Order matters: outer → inner. */
import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { BrowserRouter } from 'react-router';
import { AuthProvider } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { ModuleRegistryProvider } from '@/core/modules/ModuleRegistryContext';
import { moduleRegistry } from '@/core/modules/discovered';
import { IdleSessionGuard } from '@/app/session/IdleSessionGuard';
import { createQueryClient } from './queryClient';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    // basename lets the same build work at "/" (Firebase Hosting) and at
    // "/pacuhub/" (GitHub Pages).
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SettingsProvider>
            <ModuleRegistryProvider modules={moduleRegistry}>
              {children}
              <IdleSessionGuard />
            </ModuleRegistryProvider>
          </SettingsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
