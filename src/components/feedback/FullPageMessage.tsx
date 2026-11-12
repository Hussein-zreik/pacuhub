import type { ComponentType, ReactNode } from 'react';
import { BrandMark } from '@/components/brand/BrandMark';
import { Card } from '@/components/ui';

/** Centered single-message screen (setup required, access pending, fatal error). */
export function FullPageMessage({
  icon: Icon,
  title,
  children,
  actions,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-canvas px-4 py-10">
      <BrandMark className="mb-8" />
      <Card className="w-full max-w-lg p-8 text-center">
        {Icon && (
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Icon className="size-7" />
          </div>
        )}
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {children && <div className="mt-2 space-y-3 text-sm text-ink-muted">{children}</div>}
        {actions && <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">{actions}</div>}
      </Card>
    </main>
  );
}
