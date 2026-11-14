/**
 * Schedule tab.
 *
 * SNV2 (the roster builder) has a single manager login, so nurses never open
 * it. What staff get here:
 *   - "Request a day off": SNV2's own staff request page (already live).
 *   - Published roster: coming soon (needs a small "publish" step in SNV2).
 * People with "Manage schedule" also get Manager tools: open SNV2, and set
 * the staff request link (kept in Firestore, never in the public code).
 */
import { CalendarClock, CalendarDays, CalendarPlus, ExternalLink, Inbox, Link2, Settings2 } from 'lucide-react';
import { Alert, Badge, Card, PageHeader, Skeleton, buttonVariants } from '@/components/ui';
import { env } from '@/config/env';
import { extractFormId } from '@/services/schedule/requestLink';
import { usePermissions } from '@/core/permissions/usePermissions';
import { RequestLinkForm } from './components/RequestLinkForm';
import { StaffRequests } from './components/StaffRequests';
import { useScheduleSettings } from './hooks/useScheduleSettings';

function Section({ icon: Icon, title, badge, children }: { icon: typeof CalendarDays; title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-ink">{title}</h3>
            {badge}
          </div>
          <div className="mt-1 space-y-4 text-sm text-ink-muted">{children}</div>
        </div>
      </div>
    </Card>
  );
}

export default function ScheduleModule() {
  const { can } = usePermissions();
  const isManager = can('schedule', 'manage');
  const settings = useScheduleSettings();
  const requestLink = settings.data?.requestLink ?? null;
  const formId = extractFormId(requestLink);

  return (
    <>
      <PageHeader title="Schedule" description="Day-off requests and the unit roster." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={CalendarPlus} title="Request a day off">
          <p>Send a day-off request with a reason to the Nurse Manager. A request doesn't change the roster by itself.</p>
          {settings.isLoading ? (
            <Skeleton className="h-12 w-52" />
          ) : settings.isError ? (
            <Alert tone="warning">Couldn't load the request link. Check the connection and reload.</Alert>
          ) : requestLink ? (
            <a href={requestLink} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: 'lg' })}>
              Request a day off <ExternalLink />
            </a>
          ) : (
            <Alert tone="info">
              {isManager ? 'Add the SNV2 staff request link in Manager tools below.' : "Day-off requests aren't set up yet. Ask your Nurse Manager."}
            </Alert>
          )}
        </Section>

        <Section icon={CalendarClock} title="Published roster" badge={<Badge>Coming soon</Badge>}>
          <p>The published fortnight will appear here so you can check your shifts without leaving PACU Hub.</p>
        </Section>
      </div>

      {isManager && (
        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            <Settings2 className="size-4" aria-hidden="true" /> Manager tools
          </h3>
          <Section icon={Inbox} title="Day-off requests from staff">
            <p>Requests staff send from the link appear here, newest first. Mark each one handled once you've actioned it in the roster.</p>
            <StaffRequests formId={formId} />
          </Section>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Section icon={CalendarDays} title="SNV2 roster builder">
              <p>Build and publish the roster in SNV2. It opens in a new tab and uses its own manager sign-in.</p>
              {env.snv2Url ? (
                <a href={env.snv2Url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'secondary' })}>
                  Open SNV2 <ExternalLink />
                </a>
              ) : (
                <Alert tone="warning">The SNV2 address isn't configured (VITE_SNV2_URL).</Alert>
              )}
            </Section>
            <Section icon={Link2} title="Staff request link">
              <p>
                In SNV2, open <span className="font-semibold text-ink">Staff requests</span> and copy the staff link. Paste it here once. It's
                stored privately and shown to staff only as the button above.
              </p>
              {!settings.isLoading && <RequestLinkForm current={requestLink} />}
            </Section>
          </div>
        </div>
      )}
    </>
  );
}
