/**
 * Central error/event logger.
 *
 * Today it writes to the console. When a monitoring service is approved
 * (e.g. Sentry, Cloud Logging), wire it in HERE — no other file changes.
 * Never log patient-identifiable data.
 */
type Context = Record<string, unknown>;

export const logger = {
  error(message: string, error: unknown, context: Context = {}) {
    console.error(`[PACU Hub] ${message}`, { error, ...context });
  },
  warn(message: string, context: Context = {}) {
    console.warn(`[PACU Hub] ${message}`, context);
  },
  info(message: string, context: Context = {}) {
    if (import.meta.env.DEV) console.info(`[PACU Hub] ${message}`, context);
  },
};
