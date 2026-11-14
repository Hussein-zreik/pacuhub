import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

/** Native select (best on tablets/phones), styled like Input. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'h-11 w-full rounded-lg border border-line bg-surface px-3 text-[0.9375rem] text-ink shadow-sm focus-visible:border-brand-500 disabled:opacity-55',
      className,
    )}
    {...props}
  />
));
Select.displayName = 'Select';
