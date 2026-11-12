/**
 * Branded sign-in portal.
 *
 * Staff sign in with the SAME email + password they use for SNV2 (same
 * Firebase project, same accounts). Google sign-in can be offered as well via
 * VITE_SIGN_IN_METHODS, but is off by default — see docs/ACCESS_SETUP.md.
 */
import { ArrowLeft, CalendarDays, ClipboardCheck, ClipboardList, Eye, EyeOff, MailCheck, ShieldCheck } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { BrandMark } from '@/components/brand/BrandMark';
import { Alert, Button, Card, Input } from '@/components/ui';
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Field({ label, children, htmlFor }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}

function SignInForm({ email, setEmail, onForgot }: { email: string; setEmail: (v: string) => void; onForgot: () => void }) {
  const { signInWithPassword, signInWithGoogle, isSigningIn, signInError, clearSignInError, lastSignOutReason } = useAuth();
  const online = useOnlineStatus();
  const ids = { email: useId(), password: useId() };
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const idleMinutes = Math.round(env.idleTimeoutMs / 60_000);
  const passwordEnabled = env.signInMethods.includes('password');
  const googleEnabled = env.signInMethods.includes('google');

  const onChange = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    if (localError) setLocalError(null);
    if (signInError) clearSignInError();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!EMAIL_PATTERN.test(email.trim())) return setLocalError('Enter a valid email address.');
    if (!password) return setLocalError('Enter your password.');
    void signInWithPassword(email, password);
  };

  const error = localError ?? signInError;

  return (
    <>
      <h2 className="text-2xl font-bold tracking-tight text-ink">Sign in</h2>
      <p className="mt-1.5 text-sm text-ink-muted">
        {passwordEnabled ? 'Use the email and password given to you by your Nurse Manager.' : `Use your ${APP.institution} Google account to continue.`}
      </p>

      <div className="mt-6 space-y-3 empty:hidden">
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
        {error && <Alert tone="danger">{error}</Alert>}
        {!online && <Alert tone="warning">You are offline. Connect to the network to sign in.</Alert>}
      </div>

      {passwordEnabled && (
        <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
          <Field label="Email" htmlFor={ids.email}>
            <Input
              id={ids.email}
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => onChange(setEmail)(e.target.value)}
              disabled={isSigningIn}
              aria-invalid={Boolean(error) || undefined}
            />
          </Field>
          <Field label="Password" htmlFor={ids.password}>
            <div className="relative">
              <Input
                id={ids.password}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => onChange(setPassword)(e.target.value)}
                disabled={isSigningIn}
                className="pr-12"
                aria-invalid={Boolean(error) || undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-subtle hover:text-ink"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </Field>
          <Button type="submit" size="lg" fullWidth loading={isSigningIn} disabled={!online}>
            {isSigningIn ? 'Signing in…' : 'Sign in'}
          </Button>
          <div className="text-center">
            <button type="button" onClick={onForgot} className="text-sm font-semibold text-brand-700 hover:underline">
              Forgot password?
            </button>
          </div>
        </form>
      )}

      {googleEnabled && (
        <>
          {passwordEnabled && (
            <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
            </div>
          )}
          <Button
            size="lg"
            variant="secondary"
            fullWidth
            className={passwordEnabled ? '' : 'mt-6'}
            onClick={() => void signInWithGoogle()}
            loading={isSigningIn && !passwordEnabled}
            disabled={!online || isSigningIn}
          >
            <GoogleIcon className="size-5" /> Sign in with Google
          </Button>
        </>
      )}
    </>
  );
}

function ResetForm({ email, setEmail, onBack }: { email: string; setEmail: (v: string) => void; onBack: () => void }) {
  const { sendPasswordReset } = useAuth();
  const online = useOnlineStatus();
  const emailId = useId();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!EMAIL_PATTERN.test(email.trim())) return setError('Enter a valid email address.');
    setSending(true);
    setError(null);
    const problem = await sendPasswordReset(email);
    setSending(false);
    if (problem) setError(problem);
    else setSentTo(email.trim());
  };

  return (
    <>
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="size-4" /> Back to sign in
      </button>
      <h2 className="text-2xl font-bold tracking-tight text-ink">Reset password</h2>

      {sentTo ? (
        <div className="mt-6 space-y-4">
          <Alert tone="success" title="Check your email">
            If an account exists for <span className="font-semibold">{sentTo}</span>, a reset link has been sent. Check your spam folder if
            it doesn't arrive within a few minutes.
          </Alert>
          <Button size="lg" fullWidth onClick={onBack}>
            <MailCheck /> Back to sign in
          </Button>
        </div>
      ) : (
        <>
          <p className="mt-1.5 text-sm text-ink-muted">We'll email you a link to choose a new password.</p>
          <Alert tone="info" className="mt-4">
            If you also use this account for SNV2, this changes that password too.
          </Alert>
          <form className="mt-6 space-y-4" onSubmit={(e) => void submit(e)} noValidate>
            <Field label="Email" htmlFor={emailId}>
              <Input
                id={emailId}
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                disabled={sending}
              />
            </Field>
            {error && <Alert tone="danger">{error}</Alert>}
            <Button type="submit" size="lg" fullWidth loading={sending} disabled={!online}>
              Send reset link
            </Button>
          </form>
        </>
      )}
    </>
  );
}

export function LoginPage() {
  useDocumentTitle('Sign in');
  const [view, setView] = useState<'signin' | 'reset'>('signin');
  // Shared between both views so the email isn't retyped.
  const [email, setEmail] = useState('');

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel — hidden on small screens to keep the form above the fold */}
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

      <section className="flex items-center justify-center bg-gradient-to-b from-brand-50 to-surface px-4 py-12 lg:bg-none lg:bg-surface">
        <div className="w-full max-w-sm">
          <BrandMark className="mb-10" />
          <Card className="p-7 shadow-raised lg:border-0 lg:p-0 lg:shadow-none">
            {view === 'signin' ? (
              <SignInForm email={email} setEmail={setEmail} onForgot={() => setView('reset')} />
            ) : (
              <ResetForm email={email} setEmail={setEmail} onBack={() => setView('signin')} />
            )}
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
