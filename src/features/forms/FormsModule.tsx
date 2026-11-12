/**
 * PACU Forms — placeholder while form definitions are being gathered.
 * The registry, routing, permissions and error isolation are already live;
 * the schema-driven form engine is built here once the first forms are confirmed.
 */
import { CheckCircle2, ClipboardList } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '@/components/ui';

const PLANNED = [
  'Standardized unit checklists and PACU forms',
  'Auto-saved drafts so work is never lost',
  'Clear validation before submission',
  'Locked submissions with a full amendment history',
];

export default function FormsModule() {
  return (
    <>
      <PageHeader title="PACU Forms" description="Clinical documentation and unit checklists." />
      <Card>
        <EmptyState
          icon={ClipboardList}
          title="Forms are being set up"
          description="This module is being configured with the unit's standardized forms."
        />
        <ul className="mx-auto max-w-md space-y-2 px-6 pb-10">
          {PLANNED.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-ink-muted">
              <CheckCircle2 className="size-4 shrink-0 text-brand-500" aria-hidden="true" /> {item}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
