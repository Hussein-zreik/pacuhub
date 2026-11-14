import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { ModuleRegistryProvider } from '@/core/modules/ModuleRegistryContext';
import { moduleRegistry } from '@/core/modules/discovered';
import { DEFAULT_APP, DEFAULT_PREFS, DEFAULT_PUBLIC } from '@/services/settings/model';
import SettingsModule from './SettingsModule';

const NO_STAMP = { updatedAt: null, updatedByName: null };
const settings = vi.hoisted(() => ({
  watchPublicSettings: vi.fn(),
  watchAppSettings: vi.fn(),
  watchPrefs: vi.fn(),
  savePublicSettings: vi.fn(),
  saveAppSettings: vi.fn(),
  savePrefs: vi.fn(),
}));
const activity = vi.hoisted(() => ({ logActivity: vi.fn(async () => {}), watchActivity: vi.fn() }));
vi.mock('@/services/settings/settingsService', () => settings);
vi.mock('@/services/activity/activityLog', async (orig) => ({ ...(await orig<object>()), ...activity }));

const me = { uid: 'u1', email: 'maya@aub.edu.lb', displayName: 'Maya Khoury', photoURL: null };

function renderSettings(access: Record<string, string>) {
  const auth: AuthContextValue = {
    state: { status: 'authorized', user: me, access },
    isSigningIn: false, signInError: null, lastSignOutReason: null,
    signInWithPassword: vi.fn(), signUp: vi.fn(), signInWithGoogle: vi.fn(), sendPasswordReset: vi.fn(), clearSignInError: vi.fn(),
    signOut: vi.fn(), refreshAccess: vi.fn(),
  };
  return render(
    <AuthContext.Provider value={auth}>
      <ModuleRegistryProvider modules={moduleRegistry}>
        <SettingsProvider>
          <SettingsModule />
        </SettingsProvider>
      </ModuleRegistryProvider>
    </AuthContext.Provider>,
  );
}

describe('Settings tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings.watchPublicSettings.mockImplementation((cb) => (cb(DEFAULT_PUBLIC, NO_STAMP), () => {}));
    settings.watchAppSettings.mockImplementation((cb) => (cb(DEFAULT_APP, NO_STAMP), () => {}));
    settings.watchPrefs.mockImplementation((_uid, cb) => (cb(DEFAULT_PREFS), () => {}));
    settings.saveAppSettings.mockResolvedValue(undefined);
    settings.savePublicSettings.mockResolvedValue(undefined);
    activity.watchActivity.mockImplementation((cb) => (cb([{ id: 'a1', type: 'dayoff', summary: 'Approved Lina — 2026-12-01', byName: 'Maya Khoury', at: new Date('2026-11-14T09:00') }]), () => {}));
  });

  it('staff see only their own preferences (no Unit or Activity tabs)', () => {
    renderSettings({ schedule: 'view' });
    expect(screen.getByRole('radiogroup', { name: /theme/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /unit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /activity/i })).not.toBeInTheDocument();
  });

  it('admin publishes an announcement and it is logged', async () => {
    const user = userEvent.setup();
    renderSettings({ 'staff-access': 'admin' });
    await user.click(screen.getByRole('tab', { name: /unit/i }));
    await user.type(screen.getByLabelText(/message/i), 'Fire drill Tuesday 10:00');
    await user.click(screen.getByRole('button', { name: /publish/i }));
    expect(await screen.findByText(/published to everyone/i)).toBeInTheDocument();
    expect(settings.saveAppSettings).toHaveBeenCalledWith(
      expect.objectContaining({ announcement: { text: 'Fire drill Tuesday 10:00', tone: 'info', expiresOn: null } }),
      { uid: 'u1', name: 'Maya Khoury' },
    );
    expect(activity.logActivity).toHaveBeenCalledWith('settings', expect.stringMatching(/Published announcement/), { uid: 'u1', name: 'Maya Khoury' });
  });

  it('rejects an invalid sign-up domain before saving', async () => {
    const user = userEvent.setup();
    renderSettings({ 'staff-access': 'admin' });
    await user.click(screen.getByRole('tab', { name: /unit/i }));
    const section = screen.getByRole('heading', { name: /^sign-up$/i }).parentElement!;
    await user.type(within(section).getByLabelText(/email domains/i), 'not a domain');
    await user.click(within(section).getByRole('button', { name: /save/i }));
    expect(await within(section).findByText(/not a valid domain/i)).toBeInTheDocument();
    expect(settings.savePublicSettings).not.toHaveBeenCalled();
  });

  it('admin sees the activity log', async () => {
    const user = userEvent.setup();
    renderSettings({ 'staff-access': 'admin' });
    await user.click(screen.getByRole('tab', { name: /activity/i }));
    expect(screen.getByText('Approved Lina — 2026-12-01')).toBeInTheDocument();
    expect(screen.getByText(/Maya Khoury ·/)).toBeInTheDocument();
  });
});
