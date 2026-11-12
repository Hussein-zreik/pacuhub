import { BrandMark } from '@/components/brand/BrandMark';
import { Spinner } from '@/components/ui';

export function FullPageLoader({ label = 'Loading PACU Hub…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas" role="status" aria-live="polite">
      <BrandMark />
      <div className="flex items-center gap-3 text-sm text-ink-muted">
        <Spinner className="text-brand-600" label="" />
        {label}
      </div>
    </div>
  );
}
