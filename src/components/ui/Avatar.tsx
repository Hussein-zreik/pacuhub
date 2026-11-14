import { useState } from 'react';
import { cn } from '@/utils/cn';
import { initials } from '@/utils/format';

/** Profile photo with an initials fallback (also used if the photo fails to load). */
export function Avatar({
  name,
  email,
  photoURL,
  className,
}: {
  name: string | null;
  email?: string | null;
  photoURL?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const base = cn('size-9 shrink-0 rounded-full', className);

  if (photoURL && !failed) {
    // no-referrer is required for Google profile photos to load reliably
    return <img src={photoURL} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={cn(base, 'border border-line object-cover')} />;
  }
  return (
    <span className={cn(base, 'flex items-center justify-center bg-brand-100 text-sm font-bold text-accent-strong')} aria-hidden="true">
      {initials(name, email)}
    </span>
  );
}
