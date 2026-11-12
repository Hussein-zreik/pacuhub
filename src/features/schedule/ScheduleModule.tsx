/**
 * Schedule module — SNV2 integration.
 *
 * Integration mode is configuration-driven (VITE_SNV2_MODE) because the SNV2
 * hosting/auth details are still being confirmed:
 *   - `launch`: launchpad card, opens SNV2 in a new tab (works everywhere)
 *   - `embed` : SNV2 inside the Hub (requires SNV2 to allow framing)
 * A future `api` mode (native schedule view) slots in here without touching
 * the rest of the Hub.
 */
import { CalendarOff } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { env } from '@/config/env';
import { Snv2Embed } from './components/Snv2Embed';
import { Snv2Launchpad } from './components/Snv2Launchpad';

export default function ScheduleModule() {
  const { url, mode } = env.snv2;

  if (!url) {
    return (
      <>
        <PageHeader title="Schedule" description="Unit staffing schedule (SNV2)." />
        <Card>
          <EmptyState
            icon={CalendarOff}
            title="SNV2 is not connected yet"
            description={
              <>
                The scheduling application hasn't been linked to PACU Hub. An administrator can set{' '}
                <code className="font-mono text-xs">VITE_SNV2_URL</code> to enable it.
              </>
            }
          />
        </Card>
      </>
    );
  }

  return mode === 'embed' ? <Snv2Embed url={url} /> : <Snv2Launchpad url={url} />;
}
