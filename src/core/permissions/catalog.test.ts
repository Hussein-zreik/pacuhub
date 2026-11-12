import { describe, expect, it } from 'vitest';
import { ACCESS_PRESETS, accessLabel, expandPreset, matchPreset } from '@/config/accessPresets';
import { buildCatalog, canOpenModule, hasLevel, isAdmin, sanitizeAccess, summarizeAccess } from './catalog';

const modules = [
  { id: 'home', label: 'Home' },
  { id: 'schedule', label: 'Schedule', permissions: { levels: [{ id: 'view', label: 'View schedule' }] } },
  {
    id: 'forms',
    label: 'PACU Forms',
    permissions: { levels: [{ id: 'fill', label: 'Fill forms' }, { id: 'review', label: 'Fill & review' }] },
  },
  {
    id: 'audits',
    label: 'Unit Audits',
    permissions: {
      levels: [{ id: 'view', label: 'View results' }, { id: 'enter', label: 'Enter & view' }, { id: 'full', label: 'Enter, view & export' }],
      areas: [
        { id: 'brief-op-notes', label: 'Brief Op Notes' },
        { id: 'staff-education', label: 'Staff Education' },
        { id: 'infection-control', label: 'Infection Control & Safety' },
      ],
    },
  },
  { id: 'staff-access', label: 'Staff Access', permissions: { levels: [{ id: 'admin', label: 'Admin' }] } },
];
const catalog = buildCatalog(modules);
const [home, schedule, , audits] = modules;

describe('permission catalog', () => {
  it('creates one area per module, or one per sub-area (audit type)', () => {
    expect(catalog.areas.map((a) => a.key)).toEqual([
      'schedule',
      'forms',
      'audits:brief-op-notes',
      'audits:staff-education',
      'audits:infection-control',
      'staff-access',
    ]);
  });

  it('nurse X: only Infection Control audits — nothing else', () => {
    const x = { 'audits:infection-control': 'enter' };
    expect(canOpenModule(audits!, x)).toBe(true);
    expect(canOpenModule(schedule!, x)).toBe(false);
    expect(hasLevel(x, catalog, 'audits:infection-control', 'view')).toBe(true); // enter includes view
    expect(hasLevel(x, catalog, 'audits:infection-control', 'full')).toBe(false); // but not export
    expect(hasLevel(x, catalog, 'audits:brief-op-notes', 'view')).toBe(false); // other audit type
  });

  it('nurse Y: only the schedule', () => {
    const y = { schedule: 'view' };
    expect(canOpenModule(schedule!, y)).toBe(true);
    expect(canOpenModule(audits!, y)).toBe(false);
  });

  it('modules without permissions (Home) are open to every approved user', () => {
    expect(canOpenModule(home!, {})).toBe(true);
  });

  it('unknown areas or levels never grant access', () => {
    expect(hasLevel({ schedule: 'superuser' }, catalog, 'schedule', 'view')).toBe(false);
    expect(hasLevel({ ghost: 'view' }, catalog, 'ghost', 'view')).toBe(false);
    expect(sanitizeAccess({ schedule: 'superuser', forms: 'fill', x: 3, audits: 'none' }, catalog)).toEqual({ forms: 'fill' });
    expect(sanitizeAccess(['admin'])).toEqual({});
  });

  it('identifies admins only by the exact admin level', () => {
    expect(isAdmin({ 'staff-access': 'admin' })).toBe(true);
    expect(isAdmin({ 'staff-access': 'Admin' })).toBe(false);
  });

  it('summarizes access in plain language', () => {
    expect(summarizeAccess({ forms: 'review', 'audits:brief-op-notes': 'view', 'audits:infection-control': 'enter' }, catalog)).toEqual([
      { moduleId: 'forms', moduleLabel: 'PACU Forms', detail: 'Fill & review' },
      { moduleId: 'audits', moduleLabel: 'Unit Audits', detail: '2 of 3 types' },
    ]);
    const allView = { 'audits:brief-op-notes': 'view', 'audits:staff-education': 'view', 'audits:infection-control': 'view' };
    expect(summarizeAccess(allView, catalog)[0]?.detail).toBe('View results · all types');
  });
});

describe('templates', () => {
  const preset = (id: string) => ACCESS_PRESETS.find((p) => p.id === id)!;

  it('Educator gets the highest level on EVERY audit type (including future ones)', () => {
    expect(expandPreset(preset('educator'), catalog)).toEqual({
      schedule: 'view',
      forms: 'fill',
      'audits:brief-op-notes': 'full',
      'audits:staff-education': 'full',
      'audits:infection-control': 'full',
    });
  });

  it('Nurse Manager gets everything, including admin', () => {
    const manager = expandPreset(preset('nurse-manager'), catalog);
    expect(Object.keys(manager)).toHaveLength(catalog.areas.length);
    expect(isAdmin(manager)).toBe(true);
  });

  it('recognises an unmodified template, and "Custom" once adjusted', () => {
    const staff = expandPreset(preset('staff-nurse'), catalog);
    expect(matchPreset(staff, catalog)?.id).toBe('staff-nurse');
    expect(accessLabel({ ...staff, 'audits:infection-control': 'view' }, catalog)).toBe('Custom access');
  });
});
