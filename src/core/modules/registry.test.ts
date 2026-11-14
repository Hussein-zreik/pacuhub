import { describe, expect, it } from 'vitest';
import { accessibleModules, buildRegistry, definitionsFromGlob } from './registry';
import { defineModule, type HubModuleDefinition } from './types';

const Icon = () => null;
const make = (overrides: Partial<HubModuleDefinition>): HubModuleDefinition =>
  defineModule({
    id: 'sample',
    label: 'Sample',
    description: 'A sample module',
    icon: Icon,
    path: 'sample',
    order: 1,
    load: async () => ({ default: () => null }),
    ...overrides,
  });

describe('buildRegistry', () => {
  it('sorts by order and applies defaults', () => {
    const registry = buildRegistry([make({ id: 'b', path: 'b', order: 2 }), make({ id: 'a', path: 'a', order: 1 })]);
    expect(registry.map((m) => m.id)).toEqual(['a', 'b']);
    expect(registry[0]).toMatchObject({ status: 'live', showInNav: true });
    expect(registry[0]?.Component).toBeDefined();
  });

  it('rejects duplicate ids and paths', () => {
    expect(() => buildRegistry([make({ id: 'x', path: 'one' }), make({ id: 'x', path: 'two' })])).toThrow(/Duplicate module id/);
    expect(() => buildRegistry([make({ id: 'one', path: 'p' }), make({ id: 'two', path: 'p' })])).toThrow(/Duplicate module path/);
  });

  it('rejects malformed and reserved paths', () => {
    expect(() => buildRegistry([make({ path: 'Bad Path' })])).toThrow(/Invalid path/);
    expect(() => buildRegistry([make({ path: 'login' })])).toThrow(/reserved/);
  });

  it('rejects malformed permission declarations', () => {
    expect(() => buildRegistry([make({ permissions: { levels: [] } })])).toThrow(/no levels/);
    expect(() => buildRegistry([make({ permissions: { levels: [{ id: 'none', label: 'x' }] } })])).toThrow(/Invalid level/);
    expect(() =>
      buildRegistry([make({ permissions: { levels: [{ id: 'view', label: 'a' }, { id: 'view', label: 'b' }] } })]),
    ).toThrow(/Duplicate level/);
    expect(() =>
      buildRegistry([make({ permissions: { levels: [{ id: 'view', label: 'a' }], areas: [{ id: 'A B', label: 'x' }] } })]),
    ).toThrow(/Invalid area/);
  });

  it('returns an immutable registry', () => {
    const registry = buildRegistry([make({})]);
    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry[0])).toBe(true);
  });
});

describe('accessibleModules', () => {
  it('shows each person only the modules they have access to', () => {
    const view = { levels: [{ id: 'view', label: 'View' }] };
    const registry = buildRegistry([
      make({ id: 'open', path: 'open' }),
      make({ id: 'schedule', path: 'schedule', permissions: view }),
      make({ id: 'audits', path: 'audits', permissions: view }),
    ]);
    expect(accessibleModules(registry, { schedule: 'view' }).map((m) => m.id)).toEqual(['open', 'schedule']);
    expect(accessibleModules(registry, { audits: 'view' }).map((m) => m.id)).toEqual(['open', 'audits']);
  });
});

describe('definitionsFromGlob', () => {
  it('throws a helpful error when a module file has no default export', () => {
    expect(() => definitionsFromGlob({ '/src/features/x/module.ts': {} })).toThrow(/export default defineModule/);
  });
});

describe('discovered feature modules', () => {
  it('registers every real feature module without validation errors', async () => {
    const { moduleRegistry } = await import('./discovered');
    expect(moduleRegistry.map((m) => m.id)).toEqual(['home', 'bayboard', 'schedule', 'forms', 'audits', 'staff-access', 'settings']);
  });
});
