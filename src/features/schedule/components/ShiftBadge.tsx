import type { CSSProperties } from 'react';
import { CORE_SHIFTS, type CustomShift } from '@/services/roster/published';
import { cn } from '@/utils/cn';

const KIND_CLASS = { day: 'shift-day', evening: 'shift-evening', night: 'shift-night', leave: 'shift-leave', off: 'shift-off' } as const;

function shiftClass(code: string): string {
  if (code === 'REQ') return 'shift-req';
  const kind = CORE_SHIFTS[code]?.kind;
  return kind ? KIND_CLASS[kind] : '';
}

function customStyle(code: string, custom: readonly CustomShift[]): CSSProperties | undefined {
  const c = custom.find((s) => s.code === code);
  return c ? { background: `${c.color}2e`, color: c.color } : undefined;
}

/** A shift code as SNV2 shows it. OFF renders as a quiet dash. */
export function ShiftBadge({ code, custom, className }: { code: string; custom: readonly CustomShift[]; className?: string }) {
  const off = code === 'OFF';
  return (
    <span
      className={cn('inline-flex min-w-9 items-center justify-center rounded-md px-1.5 py-1 text-xs font-bold tabular-nums', shiftClass(code), className)}
      style={customStyle(code, custom)}
    >
      {off ? '–' : code === 'REQ' ? 'Req' : code}
    </span>
  );
}
