/**
 * PACU Hub wordmark.
 *
 * LOGO SLOT: the official AUBMC logo is pending approval. When approved, place
 * the file in /public/brand/ and render it here — this is the single component
 * every screen uses, so no other file needs to change.
 */
import { Activity } from 'lucide-react';
import { APP } from '@/config/app';
import { cn } from '@/utils/cn';

export function BrandMark({
  compact = false,
  subtitle = `${APP.institution} · ${APP.unit}`,
  className,
}: {
  compact?: boolean;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
        <Activity className="size-5" aria-hidden="true" />
      </div>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="text-base font-bold tracking-tight text-ink">{APP.name}</p>
          <p className="truncate text-xs font-medium text-ink-muted">{subtitle}</p>
        </div>
      )}
    </div>
  );
}
