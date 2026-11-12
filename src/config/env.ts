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

  VITE_IDLE_TIMEOUT_MINUTES: z.coerce.number().min(1).max(60).default(5),
  VITE_IDLE_WARNING_SECONDS: z.coerce.number().int().min(0).max(300).default(60),

  VITE_SNV2_URL: z.url({ protocol: /^https?$/ }).optional(),
  VITE_SNV2_MODE: z.enum(['embed', 'launch']).default('launch'),
});

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

export interface AppEnv {
  /** `null` when the Firebase web config is incomplete. */
  firebase: FirebaseWebConfig | null;
  allowedEmailDomains: string[];
  idleTimeoutMs: number;
  idleWarningMs: number;
  snv2: { url: string | null; mode: 'embed' | 'launch' };
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

  const idleTimeoutMs = config.VITE_IDLE_TIMEOUT_MINUTES * 60_000;
  // The warning can never be longer than the timeout itself.
  const idleWarningMs = Math.min(config.VITE_IDLE_WARNING_SECONDS * 1000, idleTimeoutMs);

  return {
    firebase,
    allowedEmailDomains: config.VITE_ALLOWED_EMAIL_DOMAINS,
    idleTimeoutMs,
    idleWarningMs,
    snv2: { url: config.VITE_SNV2_URL ?? null, mode: config.VITE_SNV2_MODE },
    issues,
    warnings,
  };
}

export const env: AppEnv = parseEnv(import.meta.env as unknown as Record<string, unknown>);
