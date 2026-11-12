import { describe, expect, it } from 'vitest';
import { decideAccess, parseUserProfile } from './access';
import type { UserProfile } from './types';

const base: UserProfile = {
  uid: 'u1', email: 'n@aub.edu.lb', displayName: 'N', photoURL: null,
  access: {}, status: 'pending', owner: false, createdAt: null, lastSignInAt: null, updatedAt: null, updatedBy: null,
};

describe('decideAccess', () => {
  it('grants access only when active AND given at least one tab', () => {
    expect(decideAccess({ ...base, status: 'active', access: { schedule: 'view' } })).toEqual({ kind: 'granted', access: { schedule: 'view' } });
    expect(decideAccess({ ...base, status: 'active', access: {} })).toEqual({ kind: 'pending' });
    expect(decideAccess({ ...base, status: 'pending', access: { 'staff-access': 'admin' } })).toEqual({ kind: 'pending' });
  });

  it('treats deactivated accounts as disabled even if access settings remain', () => {
    expect(decideAccess({ ...base, status: 'disabled', access: { 'staff-access': 'admin' } })).toEqual({ kind: 'disabled' });
  });

  it('treats a missing record as pending', () => {
    expect(decideAccess(null)).toEqual({ kind: 'pending' });
  });
});

describe('parseUserProfile', () => {
  const ts = (iso: string) => ({ toDate: () => new Date(iso) });

  it('parses a valid record and converts timestamps', () => {
    const profile = parseUserProfile('u1', {
      email: 'n@aub.edu.lb', displayName: 'Nour', access: { forms: 'review' }, status: 'active',
      createdAt: ts('2026-11-01T08:00:00Z'), lastSignInAt: ts('2026-11-12T07:00:00Z'),
    });
    expect(profile).toMatchObject({ uid: 'u1', access: { forms: 'review' }, status: 'active', photoURL: null, updatedBy: null });
    expect(profile?.createdAt?.toISOString()).toBe('2026-11-01T08:00:00.000Z');
  });

  it('fails closed on malformed data', () => {
    const profile = parseUserProfile('u1', { access: { schedule: 'view', forms: 7, audits: 'none' }, status: 'god-mode' });
    expect(profile?.access).toEqual({ schedule: 'view' });
    expect(profile?.status).toBe('pending');
    expect(decideAccess(profile)).toEqual({ kind: 'pending' });
    expect(parseUserProfile('u1', { access: ['admin'], status: 'active' })?.access).toEqual({});
  });
});
