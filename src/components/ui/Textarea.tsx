import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'min-h-24 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[0.9375rem] text-ink shadow-sm placeholder:text-ink-subtle focus-visible:border-brand-500 disabled:opacity-55',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
