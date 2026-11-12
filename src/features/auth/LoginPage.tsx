/**
 * Branded sign-in portal. One action, one button — designed to be completed
 * in seconds at the start of a shift.
 */
import { ClipboardCheck, ClipboardList, CalendarDays, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import { Alert, Button, Card } from '@/components/ui';
import { APP } from '@/config/app';
import { env } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { GoogleIcon } from './GoogleIcon';

const HIGHLIGHTS = [
  { icon: CalendarDays, text: 'Unit schedule at a glance' },
  { icon: ClipboardList, text: 'Standardized PACU forms & checklists' },
  { icon: ClipboardCheck, text: 'Quality & compliance audits' },
];

export function LoginPage() {
  useDocumentTitle('Sign in');
  const { signIn, isSigningIn, signInError, lastSignOutReason } = useAuth();
  const online = useOnlineStatus();
  const idleMinutes = Math.round(env.idleTimeoutMs / 60_000);

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel — hidden on small screens to keep the sign-in button above the fold */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-white/5" aria-hidden="true" />
        <p className="relative text-sm font-semibold uppercase tracking-widest text-brand-100">
          {APP.institution} · {APP.unit}
        </p>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">{APP.name}</h1>
          <p className="mt-3 text-lg text-brand-100">{APP.tagline}</p>
          <ul className="mt-10 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[0.9375rem]">
                <span className="flex size-9 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-100/80">For authorized {APP.institution} personnel only.</p>
      </section>

      {/* Sign-in panel */}
      <section className="flex items-center justify-center bg-gradient-to-b from-brand-50 to-surface px-4 py-12 lg:bg-none lg:bg-surface">
        <div className="w-full max-w-sm">
          <BrandMark className="mb-10" />
          <Card className="p-7 shadow-raised lg:border-0 lg:p-0 lg:shadow-none">
            <h2 className="text-2xl font-bold tracking-tight text-ink">Sign in</h2>
            <p className="mt-1.5 text-sm text-ink-muted">Use your {APP.institution} Google account to continue.</p>

            <div className="mt-6 space-y-3">
              {lastSignOutReason === 'idle' && (
                <Alert tone="info" title="You were signed out">
                  For patient privacy, sessions end after {idleMinutes} minutes of inactivity.
                </Alert>
              )}
              {lastSignOutReason === 'domain-not-allowed' && (
                <Alert tone="warning" title="Account not accepted">
                  Please sign in with your {APP.institution} account.
                </Alert>
              )}
              {signInError && <Alert tone="danger">{signInError}</Alert>}
              {!online && <Alert tone="warning">You are offline. Connect to the network to sign in.</Alert>}
            </div>

            <Button
              size="lg"
              variant="secondary"
              fullWidth
              className="mt-6 border-line text-[0.9375rem]"
              onClick={() => void signIn()}
              loading={isSigningIn}
              disabled={!online}
            >
              {!isSigningIn && <GoogleIcon className="size-5" />}
              {isSigningIn ? 'Signing in…' : 'Sign in with Google'}
            </Button>

            <p className="mt-6 flex items-start gap-2 text-xs text-ink-subtle">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Access is limited to approved PACU staff. Activity in this application may be logged.
            </p>
          </Card>
        </div>
      </section>
    </main>
  );
}
