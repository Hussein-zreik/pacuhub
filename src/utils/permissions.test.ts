import { describe, expect, it } from 'vitest';
import { isEmailDomainAllowed } from '@/services/auth/authService';
import { capabilitiesFor, hasAll, normalizeRoles } from './permissions';

describe('normalizeRoles', () => {
  it('reads a single role string, tolerating case and separators', () => {
    expect(normalizeRoles({ role: 'Charge Nurse' })).toEqual(['charge_nurse']);
    expect(normalizeRoles({ role: 'STAFF-NURSE' })).toEqual(['staff_nurse']);
  });

  it('reads role arrays and boolean flags, de-duplicated in stable order', () => {
    expect(normalizeRoles({ roles: ['admin', 'educator'], educator: true })).toEqual(['educator', 'admin']);
  });

  it('ignores unknown or malformed values instead of guessing', () => {
    expect(normalizeRoles({ role: 'superuser', roles: [42, null], admin: 'yes' })).toEqual([]);
    expect(normalizeRoles(null)).toEqual([]);
  });
});

describe('capabilities', () => {
  it('unions capabilities across multiple roles', () => {
    const caps = capabilitiesFor(['staff_nurse', 'educator']);
    expect(caps.has('forms.submit')).toBe(true);
    expect(caps.has('audits.export')).toBe(true);
    expect(caps.has('admin.manage')).toBe(false);
  });

  it('requires ALL listed capabilities', () => {
    const caps = capabilitiesFor(['charge_nurse']);
    expect(hasAll(caps, undefined)).toBe(true);
    expect(hasAll(caps, 'forms.verify')).toBe(true);
    expect(hasAll(caps, ['forms.verify', 'audits.view'])).toBe(false);
  });
});

describe('isEmailDomainAllowed', () => {
  it('allows everything when no domains are configured', () => {
    expect(isEmailDomainAllowed('a@gmail.com', [])).toBe(true);
  });
  it('matches domains case-insensitively and rejects missing emails', () => {
    expect(isEmailDomainAllowed('Nurse@AUB.edu.lb', ['aub.edu.lb'])).toBe(true);
    expect(isEmailDomainAllowed('nurse@gmail.com', ['aub.edu.lb'])).toBe(false);
    expect(isEmailDomainAllowed(null, ['aub.edu.lb'])).toBe(false);
  });
});
