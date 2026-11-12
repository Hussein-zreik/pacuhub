import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-11 w-full rounded-lg border border-line bg-surface px-3 text-[0.9375rem] text-ink shadow-sm placeholder:text-ink-subtle focus-visible:border-brand-500 disabled:opacity-55',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
