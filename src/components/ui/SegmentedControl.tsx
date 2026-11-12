/**
 * Single-choice picker shown as a row of segments (an accessible radio group).
 * Arrow keys move between options, as with native radio buttons.
 */
import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/utils/cn';

export interface SegmentOption {
  value: string;
  label: string;
  /** Tooltip / screen-reader hint. */
  description?: string;
}

export interface SegmentedControlProps {
  /** Accessible name for the group, e.g. "Access to Schedule". */
  label: string;
  value: string;
  options: readonly SegmentOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function SegmentedControl({ label, value, options, onChange, disabled, className }: SegmentedControlProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(0, options.findIndex((o) => o.value === value));

  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (current + step + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
      className={cn(
        // Phones: an even 2-column grid of large targets. Wider: one row.
        'grid grid-cols-2 gap-1 rounded-lg border border-line bg-canvas p-1 sm:inline-flex sm:flex-wrap',
        disabled && 'opacity-60',
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.description}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-10 rounded-md px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed',
              selected
                ? option.value === 'none'
                  ? 'bg-surface text-ink shadow-sm ring-1 ring-line'
                  : 'bg-brand-600 text-white shadow-sm'
                : 'text-ink-muted hover:bg-surface hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
