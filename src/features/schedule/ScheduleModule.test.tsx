import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '@/context/AuthContext';
import { ModuleRegistryProvider } from '@/core/modules/ModuleRegistryContext';
import { moduleRegistry } from '@/core/modules/discovered';
import ScheduleModule from './ScheduleModule';

const service = vi.hoisted(() => ({ getScheduleSettings: vi.fn(), saveRequestLink: vi.fn() }));
vi.mock('@/services/schedule/scheduleSettingsService', () => service);
vi.mock('@/hooks/usePublishedRosters', () => ({ usePublishedRosters: () => ({ rosters: [], error: false }), useMyRosterId: () => null }));

const LINK = 'https://hussein-zreik.github.io/SNV2/request.html?f=AbCdEfGhIjKlMnOpQrSt12';

function renderAs(level: 'view' | 'manage') {
  const auth: AuthContextValue = {
    state: { status: 'authorized', user: { uid: 'u1', email: 'n@aub.edu.lb', displayName: 'N', photoURL: null }, access: { schedule: level } },
    isSigningIn: false, signInError: null, lastSignOutReason: null,
    signInWithPassword: vi.fn(), signUp: vi.fn(), signInWithGoogle: vi.fn(), sendPasswordReset: vi.fn(), clearSignInError: vi.fn(),
    signOut: vi.fn(), refreshAccess: vi.fn(),
  };
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthContext.Provider value={auth}>
        <ModuleRegistryProvider modules={moduleRegistry}>
          <ScheduleModule />
        </ModuleRegistryProvider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('Schedule tab', () => {
  beforeEach(() => {
    service.getScheduleSettings.mockReset();
    service.saveRequestLink.mockReset().mockResolvedValue(undefined);
  });

  it('staff get the "Request a day off" button, and no manager tools', async () => {
    service.getScheduleSettings.mockResolvedValue({ requestLink: LINK });
    renderAs('view');
    const button = await screen.findByRole('link', { name: /request a day off/i });
    expect(button).toHaveAttribute('href', LINK);
    expect(button).toHaveAttribute('target', '_blank');
    expect(screen.queryByText(/manager tools/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open snv2/i })).not.toBeInTheDocument();
  });

  it('staff are told to ask the manager when no link is set', async () => {
    service.getScheduleSettings.mockResolvedValue({ requestLink: null });
    renderAs('view');
    expect(await screen.findByText(/ask your nurse manager/i)).toBeInTheDocument();
  });

  it('managers can open SNV2 and save a valid request link', async () => {
    const user = userEvent.setup();
    service.getScheduleSettings.mockResolvedValue({ requestLink: null });
    renderAs('manage');
    expect(await screen.findByRole('link', { name: /open snv2/i })).toHaveAttribute('href', 'https://hussein-zreik.github.io/SNV2/');
    await user.type(await screen.findByLabelText(/snv2 staff request link/i), LINK);
    await user.click(screen.getByRole('button', { name: /save link/i }));
    expect(service.saveRequestLink).toHaveBeenCalledWith(LINK, 'u1');
  });

  it('managers cannot save a link that is not an SNV2 request link', async () => {
    const user = userEvent.setup();
    service.getScheduleSettings.mockResolvedValue({ requestLink: null });
    renderAs('manage');
    await user.type(await screen.findByLabelText(/snv2 staff request link/i), 'https://evil.example/request.html?f=AbCdEfGhIjKlMnOpQrSt12');
    await user.click(screen.getByRole('button', { name: /save link/i }));
    expect(screen.getByText(/isn't an snv2 staff request link/i)).toBeInTheDocument();
    expect(service.saveRequestLink).not.toHaveBeenCalled();
  });
});
