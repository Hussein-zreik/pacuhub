/** Authenticated application frame: navigation + header + module content area. */
import type { ReactNode } from 'react';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow-raised"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <TopBar />
        <main id="main" className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
