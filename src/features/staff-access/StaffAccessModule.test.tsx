import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '@/context/AuthContext';
import { ModuleRegistryProvider } from '@/core/modules/ModuleRegistryContext';
import { moduleRegistry } from '@/core/modules/discovered';
import type { UserProfile } from '@/services/users/types';
import StaffAccessModule from './StaffAccessModule';

const service = vi.hoisted(() => ({ listUserProfiles: vi.fn(), updateUserAccess: vi.fn() }));
vi.mock('@/services/users/userProfileService', () => service);
vi.mock('@/services/activity/activityLog', () => ({ logActivity: vi.fn(async () => {}) }));

const ADMIN = { 'staff-access': 'admin' };
const profile = (over: Partial<UserProfile>): UserProfile => ({
  uid: 'x', email: 'x@aub.edu.lb', displayName: 'X', photoURL: null, access: {}, status: 'pending',
  owner: false, createdAt: new Date('2026-11-10'), lastSignInAt: null, updatedAt: null, updatedBy: null, ...over,
});
const me = { uid: 'admin-1', email: 'manager@aub.edu.lb', displayName: 'Maya Khoury', photoURL: null };

function renderModule(staff: UserProfile[]) {
  service.listUserProfiles.mockResolvedValue(staff);
  const auth: AuthContextValue = {
    state: { status: 'authorized', user: me, access: ADMIN },
    isSigningIn: false, signInError: null, lastSignOutReason: null,
    signInWithPassword: vi.fn(), signUp: vi.fn(), signInWithGoogle: vi.fn(), sendPasswordReset: vi.fn(), clearSignInError: vi.fn(),
    signOut: vi.fn(), refreshAccess: vi.fn(),
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <ModuleRegistryProvider modules={moduleRegistry}>
          <StaffAccessModule />
        </ModuleRegistryProvider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const STAFF = [
  profile({ uid: 'p1', displayName: 'Lina Saad', email: 'lina@aub.edu.lb' }),
  profile({ uid: 'a1', displayName: 'Omar Fares', email: 'omar@aub.edu.lb', status: 'active', access: { schedule: 'view' } }),
  profile({ uid: 'admin-1', displayName: 'Maya Khoury', email: 'manager@aub.edu.lb', status: 'active', access: ADMIN }),
];

async function openReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /review request/i }));
  return screen.findByRole('dialog');
}

const pick = (dialog: HTMLElement, group: RegExp, option: RegExp) =>
  within(within(dialog).getByRole('radiogroup', { name: group })).getByRole('radio', { name: option });

describe('Staff Access — per-person, per-tab access', () => {
  beforeEach(() => service.updateUserAccess.mockReset().mockResolvedValue(undefined));

  it('Nurse X: approve with ONLY Infection Control audits (enter)', async () => {
    const user = userEvent.setup();
    renderModule(STAFF);
    const dialog = await openReview(user);

    // Starts from the Staff Nurse template; strip it back to one audit type.
    await user.click(pick(dialog, /access to schedule/i, /no access/i));
    await user.click(pick(dialog, /access to pacu forms/i, /no access/i));
    await user.click(pick(dialog, /infection control/i, /enter & view/i));
    expect(within(dialog).getByText('Custom')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /approve access/i }));

    expect(service.updateUserAccess).toHaveBeenCalledWith('p1', { access: { 'audits:infection-control': 'enter' }, status: 'active' }, 'admin-1');
  });

  it('Nurse Y: approve with ONLY the schedule', async () => {
    const user = userEvent.setup();
    renderModule(STAFF);
    const dialog = await openReview(user);
    await user.click(pick(dialog, /access to pacu forms/i, /no access/i));
    await user.click(within(dialog).getByRole('button', { name: /approve access/i }));
    expect(service.updateUserAccess).toHaveBeenCalledWith('p1', { access: { schedule: 'view' }, status: 'active' }, 'admin-1');
  });

  it('a template fills every tab in one click (Educator → all audit types)', async () => {
    const user = userEvent.setup();
    renderModule(STAFF);
    const dialog = await openReview(user);
    await user.click(within(dialog).getByRole('button', { name: /educator/i }));
    await user.click(within(dialog).getByRole('button', { name: /approve access/i }));
    expect(service.updateUserAccess.mock.calls[0]?.[1]).toEqual({
      access: {
        schedule: 'view',
        forms: 'fill',
        'audits:brief-op-notes': 'full',
        'audits:staff-education': 'full',
        'audits:infection-control': 'full',
      },
      status: 'active',
    });
  });

  it('"Set all types" applies one level to every audit type', async () => {
    const user = userEvent.setup();
    renderModule(STAFF);
    const dialog = await openReview(user);
    await user.click(within(dialog).getByRole('button', { name: /^view results$/i }));
    await user.click(within(dialog).getByRole('button', { name: /approve access/i }));
    const { access } = service.updateUserAccess.mock.calls[0]?.[1] as { access: Record<string, string> };
    expect(access['audits:brief-op-notes']).toBe('view');
    expect(access['audits:staff-education']).toBe('view');
    expect(access['audits:infection-control']).toBe('view');
  });

  it('cannot approve with no access at all', async () => {
    const user = userEvent.setup();
    renderModule(STAFF);
    const dialog = await openReview(user);
    await user.click(pick(dialog, /access to schedule/i, /no access/i));
    await user.click(pick(dialog, /access to pacu forms/i, /no access/i));
    await user.click(within(dialog).getByRole('button', { name: /approve access/i }));
    expect(within(dialog).getByText(/give access to at least one tab/i)).toBeInTheDocument();
    expect(service.updateUserAccess).not.toHaveBeenCalled();
  });

  it('declining stores no access', async () => {
    const user = userEvent.setup();
    renderModule(STAFF);
    const dialog = await openReview(user);
    await user.click(within(dialog).getByRole('button', { name: /decline/i }));
    expect(service.updateUserAccess).toHaveBeenCalledWith('p1', { access: {}, status: 'disabled' }, 'admin-1');
  });

  it('an admin can edit their own tabs, but their admin level is locked and they cannot deactivate themselves', async () => {
    const user = userEvent.setup();
    renderModule(STAFF);
    await user.click(await screen.findByRole('tab', { name: /active/i }));
    const selfRow = screen.getByText('Maya Khoury').closest('li')!;
    expect(within(selfRow).queryByRole('button', { name: /deactivate/i })).not.toBeInTheDocument();
    await user.click(within(selfRow).getByRole('button', { name: /edit my access/i }));
    const dialog = await screen.findByRole('dialog');
    expect(pick(dialog, /access to staff access/i, /no access/i)).toBeDisabled();
    expect(within(dialog).getByText(/can't remove your own admin access/i)).toBeInTheDocument();
    await user.click(pick(dialog, /access to schedule/i, /request days off/i));
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));
    expect(service.updateUserAccess).toHaveBeenCalledWith('admin-1', { access: { ...ADMIN, schedule: 'view' }, status: 'active' }, 'admin-1');
  });

  it('deactivation keeps access settings for a later restore', async () => {
    const user = userEvent.setup();
    renderModule(STAFF);
    await user.click(await screen.findByRole('tab', { name: /active/i }));
    const row = screen.getByText('Omar Fares').closest('li')!;
    await user.click(within(row).getByRole('button', { name: /deactivate/i }));
    const dialog = await screen.findByRole('dialog', { name: /deactivate access/i });
    await user.click(within(dialog).getByRole('button', { name: /^deactivate$/i }));
    expect(service.updateUserAccess).toHaveBeenCalledWith('a1', { access: { schedule: 'view' }, status: 'disabled' }, 'admin-1');
  });

  it('hides an owner account from a different admin, but still counts it (no false warning)', async () => {
    renderModule([
      profile({ uid: 'owner-1', displayName: 'Hidden Owner', status: 'active', access: ADMIN, owner: true }),
      profile({ uid: 'admin-1', displayName: 'Maya Khoury', status: 'active', access: ADMIN }),
      profile({ uid: 'p1', displayName: 'Lina Saad' }),
    ]);
    await screen.findByText('Lina Saad');
    expect(screen.queryByText('Hidden Owner')).not.toBeInTheDocument(); // hidden from this admin
    expect(screen.queryByText(/add a second admin/i)).not.toBeInTheDocument(); // owner still counts
  });

  it('shows the owner their own account, with an Owner badge', async () => {
    const auth: AuthContextValue = {
      state: { status: 'authorized', user: { ...me, uid: 'owner-1' }, access: ADMIN },
      isSigningIn: false, signInError: null, lastSignOutReason: null,
      signInWithPassword: vi.fn(), signUp: vi.fn(), signInWithGoogle: vi.fn(), sendPasswordReset: vi.fn(), clearSignInError: vi.fn(),
      signOut: vi.fn(), refreshAccess: vi.fn(),
    };
    service.listUserProfiles.mockResolvedValue([profile({ uid: 'owner-1', displayName: 'Maya Khoury', status: 'active', access: ADMIN, owner: true })]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={auth}>
          <ModuleRegistryProvider modules={moduleRegistry}>
            <StaffAccessModule />
          </ModuleRegistryProvider>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );
    await userEvent.setup().click(await screen.findByRole('tab', { name: /active/i }));
    expect(screen.getByText('Maya Khoury')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('warns while there is only one admin, and stops warning at two', async () => {
    const { unmount } = renderModule(STAFF);
    expect(await screen.findByText(/add a second admin/i)).toBeInTheDocument();
    unmount();
    renderModule([...STAFF, profile({ uid: 'admin-2', displayName: 'Second Admin', status: 'active', access: ADMIN })]);
    await screen.findByText('Lina Saad');
    expect(screen.queryByText(/add a second admin/i)).not.toBeInTheDocument();
  });
});
