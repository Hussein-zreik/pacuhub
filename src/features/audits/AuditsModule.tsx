/**
 * Unit Audits — placeholder while audit tools and scoring rules are confirmed.
 * Already permission-aware: each person sees only the audit types they were
 * given, with their level for each.
 */
import { BookOpenCheck, ClipboardCheck, FileText, ShieldPlus, type LucideIcon } from 'lucide-react';
import { Badge, Card, PageHeader } from '@/components/ui';
import { usePermissionCatalog } from '@/core/modules/ModuleRegistryContext';
import { areaKey } from '@/core/permissions/catalog';
import { usePermissions } from '@/core/permissions/usePermissions';
import { AUDIT_CATEGORIES } from './categories';

const ICONS: Record<(typeof AUDIT_CATEGORIES)[number]['id'], LucideIcon> = {
  'brief-op-notes': FileText,
  'staff-education': BookOpenCheck,
  'infection-control': ShieldPlus,
};

export default function AuditsModule() {
  const { levelOf } = usePermissions();
  const catalog = usePermissionCatalog();
  const visible = AUDIT_CATEGORIES.map((category) => {
    const key = areaKey('audits', category.id);
    const level = levelOf(key);
    const levelLabel = catalog.byKey.get(key)?.levels.find((l) => l.id === level)?.label;
    return { ...category, level, levelLabel };
  }).filter((category) => category.level !== null);

  return (
    <>
      <PageHeader
        title="Unit Audits"
        description="Quality assurance and compliance tracking with summaries and exports."
        actions={<Badge>Coming soon</Badge>}
      />
      <ul className="grid gap-4 sm:grid-cols-2">
        {visible.map(({ id, label, description, levelLabel }) => {
          const Icon = ICONS[id];
          return (
            <li key={id}>
              <Card className="flex h-full items-start gap-4 p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{label}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
                  <Badge tone="brand" className="mt-3">
                    Your access: {levelLabel}
                  </Badge>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      <Card className="mt-6 flex items-center gap-3 p-5 text-sm text-ink-muted">
        <ClipboardCheck className="size-5 shrink-0 text-brand-500" aria-hidden="true" />
        Audit forms, compliance scoring and Excel/PDF exports will appear here once the audit tools are confirmed. You'll only see the
        audit types you've been given access to.
      </Card>
    </>
  );
}
