/**
 * Settings model: shapes, safe limits, defaults and the rules that combine
 * unit and personal settings. Pure (no Firebase) so it is fully testable.
 * The SAME limits are enforced server-side in firestore.rules.
 *
 *   pacuhub_settings/public  — readable by anyone (the login screen needs it):
 *                              sign-up controls, auto sign-out policy
 *   pacuhub_settings/app     — signed-in staff: shifts, announcement,
 *                              default access template
 *   pacuhub_prefs/{uid}      — each person's own preferences
 */
import { z } from 'zod';

export const IDLE_MIN_MINUTES = 2;
export const IDLE_MAX_MINUTES = 30;
export const WARNING_OPTIONS = [30, 60, 90, 120] as const;
export const TEMPLATE_IDS = ['staff-nurse', 'charge-nurse', 'educator', 'nurse-manager'] as const;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// ── Unit: public ────────────────────────────────────────────────────────────
export const publicSettingsSchema = z.object({
  signup: z
    .object({
      enabled: z.boolean().catch(true),
      allowedDomains: z.array(z.string().trim().toLowerCase().regex(DOMAIN)).max(10).catch([]),
    })
    .catch({ enabled: true, allowedDomains: [] }),
  idle: z
    .object({
      maxMinutes: z.number().int().min(IDLE_MIN_MINUTES).max(IDLE_MAX_MINUTES).catch(5),
      warningSeconds: z.number().int().min(15).max(120).catch(60),
    })
    .catch({ maxMinutes: 5, warningSeconds: 60 }),
});
export type PublicSettings = z.infer<typeof publicSettingsSchema>;

// ── Unit: app ───────────────────────────────────────────────────────────────
export const announcementSchema = z.object({
  text: z.string().trim().min(1).max(280),
  tone: z.enum(['info', 'warning']).catch('info'),
  /** Last day shown (inclusive), or null = until removed. */
  expiresOn: z.string().regex(ISO_DAY).nullable().catch(null),
});
export type Announcement = z.infer<typeof announcementSchema>;

export const appSettingsSchema = z.object({
  shifts: z
    .object({ dayStart: z.string().regex(HHMM), dayEnd: z.string().regex(HHMM) })
    .refine((s) => s.dayStart !== s.dayEnd)
    .catch({ dayStart: '07:00', dayEnd: '19:00' }),
  announcement: announcementSchema.nullable().catch(null),
  defaultTemplate: z.enum(TEMPLATE_IDS).catch('staff-nurse'),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type ShiftTimes = AppSettings['shifts'];

// ── Personal ────────────────────────────────────────────────────────────────
export const THEMES = ['light', 'dark', 'system'] as const;
export const TEXT_SIZES = ['normal', 'large', 'xlarge'] as const;
export const userPrefsSchema = z.object({
  theme: z.enum(THEMES).catch('light'),
  textSize: z.enum(TEXT_SIZES).catch('normal'),
  /** Module id to open after sign-in, or null = Home. */
  startPage: z.string().regex(/^[a-z0-9-]{1,40}$/).nullable().catch(null),
  /** Personal sign-out time in minutes (must be ≤ unit max), or null = unit time. */
  idleMinutes: z.number().int().min(IDLE_MIN_MINUTES).max(IDLE_MAX_MINUTES).nullable().catch(null),
});
export type UserPrefs = z.infer<typeof userPrefsSchema>;

export const parsePublic = (raw: unknown) => publicSettingsSchema.parse(raw ?? {});
export const parseApp = (raw: unknown) => appSettingsSchema.parse(raw ?? {});
export const parsePrefs = (raw: unknown) => userPrefsSchema.parse(raw ?? {});

export const DEFAULT_PUBLIC = parsePublic({});
export const DEFAULT_APP = parseApp({});
export const DEFAULT_PREFS = parsePrefs({});

// ── Rules that combine settings ─────────────────────────────────────────────

/** Personal time may only be SHORTER than the unit maximum, never longer. */
export function effectiveIdle(pub: PublicSettings, prefs: UserPrefs | null): { timeoutMs: number; warningMs: number; minutes: number } {
  const max = pub.idle.maxMinutes;
  const minutes = prefs?.idleMinutes ? Math.min(prefs.idleMinutes, max) : max;
  const timeoutMs = minutes * 60_000;
  return { minutes, timeoutMs, warningMs: Math.min(pub.idle.warningSeconds * 1000, timeoutMs) };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Day shift = [dayStart, dayEnd); everything else is night. Handles windows crossing midnight. */
export function isDayShift(date: Date, shifts: ShiftTimes): boolean {
  const now = date.getHours() * 60 + date.getMinutes();
  const start = toMinutes(shifts.dayStart);
  const end = toMinutes(shifts.dayEnd);
  return start < end ? now >= start && now < end : now >= start || now < end;
}

export function announcementActive(a: Announcement | null, todayIso: string): a is Announcement {
  return !!a && (!a.expiresOn || todayIso <= a.expiresOn);
}

export function emailDomainAllowed(email: string, allowedDomains: readonly string[]): boolean {
  if (!allowedDomains.length) return true;
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  return allowedDomains.includes(domain);
}

/** Parse "aub.edu.lb, AUBMC.org.lb" → valid lowercase domains (invalid entries reported). */
export function parseDomainList(input: string): { domains: string[]; invalid: string[] } {
  const items = input.split(/[\s,;]+/).map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
  const domains = [...new Set(items.filter((d) => DOMAIN.test(d)))];
  return { domains, invalid: items.filter((d) => !DOMAIN.test(d)) };
}
