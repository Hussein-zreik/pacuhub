import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const firebase = {
  VITE_FIREBASE_API_KEY: 'key',
  VITE_FIREBASE_AUTH_DOMAIN: 'pacu.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'pacu',
  VITE_FIREBASE_APP_ID: '1:2:web:3',
};

describe('parseEnv', () => {
  it('reports a blocking issue when Firebase config is missing', () => {
    const env = parseEnv({});
    expect(env.firebase).toBeNull();
    expect(env.issues).toHaveLength(1);
  });

  it('applies safe defaults (5 min idle, 60 s warning, launch mode)', () => {
    const env = parseEnv(firebase);
    expect(env.issues).toEqual([]);
    expect(env.idleTimeoutMs).toBe(5 * 60_000);
    expect(env.idleWarningMs).toBe(60_000);
    expect(env.snv2).toEqual({ url: null, mode: 'launch' });
    expect(env.signInMethods).toEqual(['password']);
  });

  it('parses sign-in methods and falls back to password-only on bad values', () => {
    expect(parseEnv({ ...firebase, VITE_SIGN_IN_METHODS: 'password, google' }).signInMethods).toEqual(['password', 'google']);
    expect(parseEnv({ ...firebase, VITE_SIGN_IN_METHODS: 'google' }).signInMethods).toEqual(['google']);
    expect(parseEnv({ ...firebase, VITE_SIGN_IN_METHODS: 'facebook' }).signInMethods).toEqual(['password']);
  });

  it('treats blank .env values as unset', () => {
    const env = parseEnv({ ...firebase, VITE_SNV2_URL: '', VITE_SNV2_MODE: '', VITE_IDLE_TIMEOUT_MINUTES: '' });
    expect(env.snv2).toEqual({ url: null, mode: 'launch' });
    expect(env.idleTimeoutMs).toBe(5 * 60_000);
    expect(env.warnings).toEqual([]);
  });

  it('falls back per-field on invalid optional values without losing the rest', () => {
    const env = parseEnv({ ...firebase, VITE_SNV2_URL: 'not a url', VITE_SNV2_MODE: 'embed' });
    expect(env.firebase).not.toBeNull();
    expect(env.snv2).toEqual({ url: null, mode: 'embed' });
    expect(env.warnings).toHaveLength(1);
  });

  it('normalizes allowed domains and caps the warning at the timeout', () => {
    const env = parseEnv({ ...firebase, VITE_ALLOWED_EMAIL_DOMAINS: ' AUB.edu.lb, aubmc.org.lb ,', VITE_IDLE_TIMEOUT_MINUTES: '1', VITE_IDLE_WARNING_SECONDS: '120' });
    expect(env.allowedEmailDomains).toEqual(['aub.edu.lb', 'aubmc.org.lb']);
    expect(env.idleWarningMs).toBe(60_000);
  });
});
