/**
 * Environment configuration — the ONLY place that reads `import.meta.env`.
 *
 * Why: every other module consumes a typed, validated `env` object. A typo or
 * bad value in `.env` surfaces as a clear setup screen instead of an obscure
 * runtime crash deep inside a feature.
 */
import { z } from 'zod';

const optionalString = z.string().trim().min(1).optional();

const csvList = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );

const envSchema = z.object({
  VITE_FIREBASE_API_KEY: optionalString,
  VITE_FIREBASE_AUTH_DOMAIN: optionalString,
  VITE_FIREBASE_PROJECT_ID: optionalString,
  VITE_FIREBASE_STORAGE_BUCKET: optionalString,
  VITE_FIREBASE_MESSAGING_SENDER_ID: optionalString,
  VITE_FIREBASE_APP_ID: optionalString,

  VITE_ALLOWED_EMAIL_DOMAINS: csvList,
  /** Which sign-in options the login screen offers. */
  VITE_SIGN_IN_METHODS: csvList.pipe(z.array(z.enum(['password', 'google'])).min(1)).catch(['password']),
  /** Show a "Create account" option on the login screen (self-service sign-up). */
  VITE_ALLOW_SIGNUP: z.stringbool().catch(false),

  VITE_IDLE_TIMEOUT_MINUTES: z.coerce.number().min(1).max(60).default(5),
  VITE_IDLE_WARNING_SECONDS: z.coerce.number().int().min(0).max(300).default(60),

  /** SNV2 manager app (opened from the Schedule tab by "Manage schedule"). */
  VITE_SNV2_URL: z.url({ protocol: /^https$/ }).optional(),

  // SNV2's OWN Firebase project (separate from PACU Hub's). These are public
  // values — they identify SNV2's project so the manager can read day-off
  // requests inside PACU Hub. No PACU Hub data lives here.
  VITE_SNV2_FIREBASE_API_KEY: optionalString,
  VITE_SNV2_FIREBASE_AUTH_DOMAIN: optionalString,
  VITE_SNV2_FIREBASE_PROJECT_ID: optionalString,
  VITE_SNV2_FIREBASE_APP_ID: optionalString,
});

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

export type SignInMethod = 'password' | 'google';

export interface AppEnv {
  /** `null` when the Firebase web config is incomplete. */
  firebase: FirebaseWebConfig | null;
  allowedEmailDomains: string[];
  /** Sign-in options on the login screen. Default: email + password only. */
  signInMethods: SignInMethod[];
  /** Whether nurses can create their own account (then await admin approval). */
  allowSignup: boolean;
  idleTimeoutMs: number;
  idleWarningMs: number;
  /** SNV2 manager app URL, or null if not configured. */
  snv2Url: string | null;
  /** SNV2's Firebase project (to read day-off requests), or null. */
  snv2Firebase: FirebaseWebConfig | null;
  /** Blocking configuration problems — the app shows a setup screen. */
  issues: string[];
  /** Non-blocking problems — an invalid optional value fell back to its default. */
  warnings: string[];
}

/** Pure, testable parser. `.env` files yield '' for blank keys — treat as unset. */
export function parseEnv(raw: Record<string, unknown>): AppEnv {
  const cleaned = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, value === '' ? undefined : value]),
  );

  const issues: string[] = [];
  const warnings: string[] = [];

  // Parse field-by-field so ONE bad optional value (e.g. a malformed SNV2 URL)
  // falls back to its default instead of discarding the whole configuration.
  const parsed: Record<string, unknown> = {};
  for (const [key, fieldSchema] of Object.entries(envSchema.shape)) {
    const result = (fieldSchema as z.ZodType).safeParse(cleaned[key]);
    if (result.success) {
      parsed[key] = result.data;
    } else {
      warnings.push(`${key}: ${result.error.issues[0]?.message ?? 'invalid value'} — using default.`);
      parsed[key] = (fieldSchema as z.ZodType).parse(undefined);
    }
  }
  const config = parsed as z.infer<typeof envSchema>;

  const { VITE_FIREBASE_API_KEY: apiKey, VITE_FIREBASE_AUTH_DOMAIN: authDomain, VITE_FIREBASE_PROJECT_ID: projectId, VITE_FIREBASE_APP_ID: appId } = config;

  let firebase: FirebaseWebConfig | null = null;
  if (apiKey && authDomain && projectId && appId) {
    firebase = {
      apiKey,
      authDomain,
      projectId,
      appId,
      storageBucket: config.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: config.VITE_FIREBASE_MESSAGING_SENDER_ID,
    };
  } else {
    issues.push(
      'Firebase is not configured. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID and VITE_FIREBASE_APP_ID in .env.local.',
    );
  }

  const { VITE_SNV2_FIREBASE_API_KEY: s2Key, VITE_SNV2_FIREBASE_AUTH_DOMAIN: s2Auth, VITE_SNV2_FIREBASE_PROJECT_ID: s2Proj, VITE_SNV2_FIREBASE_APP_ID: s2App } = config;
  const snv2Firebase: FirebaseWebConfig | null =
    s2Key && s2Auth && s2Proj && s2App ? { apiKey: s2Key, authDomain: s2Auth, projectId: s2Proj, appId: s2App } : null;

  const idleTimeoutMs = config.VITE_IDLE_TIMEOUT_MINUTES * 60_000;
  // The warning can never be longer than the timeout itself.
  const idleWarningMs = Math.min(config.VITE_IDLE_WARNING_SECONDS * 1000, idleTimeoutMs);

  return {
    firebase,
    allowedEmailDomains: config.VITE_ALLOWED_EMAIL_DOMAINS,
    signInMethods: [...new Set(config.VITE_SIGN_IN_METHODS)],
    allowSignup: config.VITE_ALLOW_SIGNUP,
    idleTimeoutMs,
    idleWarningMs,
    snv2Url: config.VITE_SNV2_URL ?? null,
    snv2Firebase,
    issues,
    warnings,
  };
}

export const env: AppEnv = parseEnv(import.meta.env as unknown as Record<string, unknown>);
