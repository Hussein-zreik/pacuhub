import { CalendarDays, ExternalLink } from 'lucide-react';
import { Card, PageHeader, buttonVariants } from '@/components/ui';

export function Snv2Launchpad({ url }: { url: string }) {
  return (
    <>
      <PageHeader title="Schedule" description="Unit staffing schedule (SNV2)." />
      <Card className="flex flex-col items-start gap-6 p-6 md:flex-row md:items-center md:p-8">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <CalendarDays className="size-8" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-ink">SNV2 Scheduling</h3>
          <p className="mt-1 text-sm text-ink-muted">
            View shifts, assignments and schedule changes. SNV2 opens in a new tab so you can switch back to PACU Hub at any
            time.
          </p>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: 'lg' })}>
          Open schedule <ExternalLink />
        </a>
      </Card>
    </>
  );
}
