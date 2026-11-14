/**
 * Schedule tab.
 *
 * SNV2 (the roster builder) has a single manager login, so nurses never open
 * it. What staff get here:
 *   - "Request a day off": SNV2's own staff request page.
 *   - Published roster: every fortnight LOCKED in SNV2, copied automatically
 *     while a manager has SNV2 connected (names and shifts only, no comments).
 * People with "Manage schedule" also get Manager tools: day-off approvals,
 * the publishing status, open SNV2, and the staff request link.
 */
import { CalendarClock, CalendarDays, CalendarPlus, ExternalLink, Inbox, Link2, RefreshCw, Settings2 } from 'lucide-react';
import { Alert, Card, PageHeader, Skeleton, buttonVariants } from '@/components/ui';
import { env } from '@/config/env';
import { extractFormId } from '@/services/schedule/requestLink';
import { usePermissions } from '@/core/permissions/usePermissions';
import { PublishedRoster } from './components/PublishedRoster';
import { RequestLinkForm } from './components/RequestLinkForm';
import { RosterSyncStatus } from './components/RosterSyncStatus';
import { StaffRequests } from './components/StaffRequests';
import { useMyRosterId, usePublishedRosters } from '@/hooks/usePublishedRosters';
import { useRosterSync } from './hooks/useRosterSync';
import { useScheduleSettings } from './hooks/useScheduleSettings';

/** Runs the automatic SNV2 → PACU Hub publishing; mounted for schedule managers only. */
function RosterSync({ rosters }: { rosters: ReturnType<typeof usePublishedRosters>['rosters'] }) {
  const status = useRosterSync(rosters);
  return <RosterSyncStatus status={status} rosters={rosters} />;
}

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
  const published = usePublishedRosters();
  const rosterId = useMyRosterId();

  return (
    <>
      <PageHeader title="Schedule" description="Day-off requests and the unit roster." />
      <div className="space-y-4">
        <Section icon={CalendarClock} title="Published roster">
          <PublishedRoster rosters={published.rosters} error={published.error} rosterId={rosterId} isManager={isManager} />
        </Section>

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
      </div>

      {isManager && (
        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            <Settings2 className="size-4" aria-hidden="true" /> Manager tools
          </h3>
          <Section icon={Inbox} title="Day-off requests from staff">
            <p>Approve to add a request to the SNV2 roster as Req off, or reject it. Every decision is kept in History, where you can undo it.</p>
            <StaffRequests formId={formId} />
          </Section>

          <div className="mt-4">
            <Section icon={RefreshCw} title="Roster publishing">
              <p>
                Every fortnight you <span className="font-semibold text-ink">lock</span> in SNV2 is published to staff automatically while SNV2
                is connected here. Unlocking removes it. Names and shifts only, never SNV2 comments.
              </p>
              <RosterSync rosters={published.rosters} />
            </Section>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Section icon={CalendarDays} title="SNV2 roster builder">
              <p>Build the roster in SNV2 and lock a fortnight when it's final. It opens in a new tab and uses its own manager sign-in.</p>
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
