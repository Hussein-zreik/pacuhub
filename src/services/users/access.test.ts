import { describe, expect, it } from 'vitest';
import { decideAccess, parseUserProfile } from './access';
import type { UserProfile } from './types';

const base: UserProfile = {
  uid: 'u1', email: 'n@aub.edu.lb', displayName: 'N', photoURL: null,
  roles: [], status: 'pending', createdAt: null, lastSignInAt: null, updatedAt: null, updatedBy: null,
};

describe('decideAccess', () => {
  it('grants access only when active AND holding at least one role', () => {
    expect(decideAccess({ ...base, status: 'active', roles: ['staff_nurse'] })).toEqual({ kind: 'granted', roles: ['staff_nurse'] });
    expect(decideAccess({ ...base, status: 'active', roles: [] })).toEqual({ kind: 'pending' });
    expect(decideAccess({ ...base, status: 'pending', roles: ['admin'] })).toEqual({ kind: 'pending' });
  });

  it('treats deactivated accounts as disabled even if roles remain', () => {
    expect(decideAccess({ ...base, status: 'disabled', roles: ['admin'] })).toEqual({ kind: 'disabled' });
  });

  it('treats a missing record as pending', () => {
    expect(decideAccess(null)).toEqual({ kind: 'pending' });
  });
});

describe('parseUserProfile', () => {
  const ts = (iso: string) => ({ toDate: () => new Date(iso) });

  it('parses a valid record and converts timestamps', () => {
    const profile = parseUserProfile('u1', {
      email: 'n@aub.edu.lb', displayName: 'Nour', roles: ['charge_nurse'], status: 'active',
      createdAt: ts('2026-11-01T08:00:00Z'), lastSignInAt: ts('2026-11-12T07:00:00Z'),
    });
    expect(profile).toMatchObject({ uid: 'u1', roles: ['charge_nurse'], status: 'active', photoURL: null, updatedBy: null });
    expect(profile?.createdAt?.toISOString()).toBe('2026-11-01T08:00:00.000Z');
  });

  it('fails closed on malformed data: unknown roles dropped, unknown status → pending', () => {
    const profile = parseUserProfile('u1', { roles: ['admin', 'superuser', 7], status: 'god-mode' });
    expect(profile?.roles).toEqual(['admin']);
    expect(profile?.status).toBe('pending');
    expect(decideAccess(profile)).toEqual({ kind: 'pending' });
  });

  it('handles a non-array roles field', () => {
    expect(parseUserProfile('u1', { roles: 'admin', status: 'active' })?.roles).toEqual(['admin']);
    expect(parseUserProfile('u1', { roles: { a: 1 }, status: 'active' })?.roles).toEqual([]);
  });
});
