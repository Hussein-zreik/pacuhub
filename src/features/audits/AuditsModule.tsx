/** Unit Audits — placeholder while audit tools and scoring rules are confirmed. */
import { BookOpenCheck, ClipboardCheck, FileText, ShieldPlus, SquarePlus } from 'lucide-react';
import { Badge, Card, PageHeader } from '@/components/ui';

const CATEGORIES = [
  { icon: FileText, title: 'Brief Op Notes', text: 'Documentation completeness and timeliness.' },
  { icon: BookOpenCheck, title: 'Staff Education', text: 'Certifications, competencies and in-services.' },
  { icon: ShieldPlus, title: 'Infection Control & Safety', text: 'Observational and environmental audits.' },
  { icon: SquarePlus, title: 'Custom Categories', text: 'New audit types added as the unit needs them.' },
];

export default function AuditsModule() {
  return (
    <>
      <PageHeader
        title="Unit Audits"
        description="Quality assurance and compliance tracking with summaries and exports."
        actions={<Badge>Coming soon</Badge>}
      />
      <ul className="grid gap-4 sm:grid-cols-2">
        {CATEGORIES.map(({ icon: Icon, title, text }) => (
          <li key={title}>
            <Card className="flex h-full items-start gap-4 p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold text-ink">{title}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{text}</p>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <Card className="mt-6 flex items-center gap-3 p-5 text-sm text-ink-muted">
        <ClipboardCheck className="size-5 shrink-0 text-brand-500" aria-hidden="true" />
        Audit forms, compliance scoring and Excel/PDF exports will appear here once the audit tools are confirmed.
      </Card>
    </>
  );
}
