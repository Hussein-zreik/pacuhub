import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', {
  variants: {
    tone: {
      brand: 'bg-brand-100 text-brand-800',
      neutral: 'bg-slate-100 text-ink-muted',
      success: 'bg-success-50 text-success-700',
      warning: 'bg-warning-50 text-warning-700',
      danger: 'bg-danger-50 text-danger-700',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ className, tone, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
