import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '@/context/AuthContext';
import type { UserProfile } from '@/services/users/types';
import { capabilitiesFor } from '@/utils/permissions';
import StaffAccessModule from './StaffAccessModule';

const service = vi.hoisted(() => ({ listUserProfiles: vi.fn(), updateUserAccess: vi.fn() }));
vi.mock('@/services/users/userProfileService', () => service);

const profile = (over: Partial<UserProfile>): UserProfile => ({
  uid: 'x', email: 'x@aub.edu.lb', displayName: 'X', photoURL: null, roles: [], status: 'pending',
  createdAt: new Date('2026-11-10'), lastSignInAt: null, updatedAt: null, updatedBy: null, ...over,
});

const admin = { uid: 'admin-1', email: 'manager@aub.edu.lb', displayName: 'Maya Khoury', photoURL: null };

function renderModule() {
  const auth: AuthContextValue = {
    state: { status: 'authorized', user: admin, roles: ['admin'], capabilities: capabilitiesFor(['admin']) },
    isSigningIn: false, signInError: null, lastSignOutReason: null,
    signInWithPassword: vi.fn(), signInWithGoogle: vi.fn(), sendPasswordReset: vi.fn(), clearSignInError: vi.fn(), signOut: vi.fn(), refreshAccess: vi.fn(),
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <StaffAccessModule />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('Staff Access', () => {
  beforeEach(() => {
    service.updateUserAccess.mockReset().mockResolvedValue(undefined);
    service.listUserProfiles.mockReset().mockResolvedValue([
      profile({ uid: 'p1', displayName: 'Lina Saad', email: 'lina@aub.edu.lb' }),
      profile({ uid: 'a1', displayName: 'Omar Fares', email: 'omar@aub.edu.lb', status: 'active', roles: ['charge_nurse'] }),
      profile({ uid: 'admin-1', displayName: 'Maya Khoury', email: 'manager@aub.edu.lb', status: 'active', roles: ['admin'] }),
    ]);
  });

  it('opens on pending requests and approves with the chosen roles', async () => {
    const user = userEvent.setup();
    renderModule();

    expect(await screen.findByText('Lina Saad')).toBeInTheDocument();
    expect(screen.queryByText('Omar Fares')).not.toBeInTheDocument(); // active tab not shown

    await user.click(screen.getByRole('button', { name: /review request/i }));
    const dialog = await screen.findByRole('dialog');
    // Staff Nurse is pre-selected; add Charge Nurse as well.
    await user.click(within(dialog).getByRole('checkbox', { name: /^charge nurse/i }));
    await user.click(within(dialog).getByRole('button', { name: /approve access/i }));

    expect(service.updateUserAccess).toHaveBeenCalledWith('p1', { roles: ['staff_nurse', 'charge_nurse'], status: 'active' }, 'admin-1');
  });

  it('requires at least one role before approving', async () => {
    const user = userEvent.setup();
    renderModule();
    await user.click(await screen.findByRole('button', { name: /review request/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('checkbox', { name: /^staff nurse/i })); // untick the default
    await user.click(within(dialog).getByRole('button', { name: /approve access/i }));
    expect(within(dialog).getByText(/select at least one role/i)).toBeInTheDocument();
    expect(service.updateUserAccess).not.toHaveBeenCalled();
  });

  it('declining a request deactivates it with no roles', async () => {
    const user = userEvent.setup();
    renderModule();
    await user.click(await screen.findByRole('button', { name: /review request/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /decline/i }));
    expect(service.updateUserAccess).toHaveBeenCalledWith('p1', { roles: [], status: 'disabled' }, 'admin-1');
  });

  it("never offers actions on the admin's own record", async () => {
    const user = userEvent.setup();
    renderModule();
    await user.click(await screen.findByRole('tab', { name: /active/i }));
    const selfRow = screen.getByText('Maya Khoury').closest('li')!;
    expect(within(selfRow).queryByRole('button')).not.toBeInTheDocument();
    expect(within(selfRow).getByText(/another admin must change your access/i)).toBeInTheDocument();
  });

  it('deactivation asks for confirmation and keeps roles for later restore', async () => {
    const user = userEvent.setup();
    renderModule();
    await user.click(await screen.findByRole('tab', { name: /active/i }));
    const row = screen.getByText('Omar Fares').closest('li')!;
    await user.click(within(row).getByRole('button', { name: /deactivate/i }));
    const dialog = await screen.findByRole('dialog', { name: /deactivate access/i });
    await user.click(within(dialog).getByRole('button', { name: /^deactivate$/i }));
    expect(service.updateUserAccess).toHaveBeenCalledWith('a1', { roles: ['charge_nurse'], status: 'disabled' }, 'admin-1');
  });
});
