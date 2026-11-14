import type { ReactNode } from 'react';
import { Card } from '@/components/ui';
import type { Stamp } from '@/services/settings/settingsService';
import { formatDateTime } from '@/utils/format';

export function SettingsSection({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <Card className="p-5 md:p-6">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
      {footer && <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">{footer}</div>}
    </Card>
  );
}

export function Field({ label, hint, htmlFor, children }: { label: string; hint?: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

export function StampLine({ stamp }: { stamp: Stamp }) {
  if (!stamp.updatedAt) return <span className="text-xs text-ink-subtle">Using default settings</span>;
  return (
    <span className="text-xs text-ink-subtle">
      Last changed {formatDateTime(stamp.updatedAt)}
      {stamp.updatedByName ? ` by ${stamp.updatedByName}` : ''}
    </span>
  );
}
