import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue, type AuthState } from '@/context/AuthContext';
import { ModuleRegistryProvider } from '@/core/modules/ModuleRegistryContext';
import { buildRegistry } from '@/core/modules/registry';
import { capabilitiesFor } from '@/utils/permissions';
import { ProtectedLayout } from './ProtectedLayout';

const user = { uid: 'u1', email: 'nurse@aub.edu.lb', displayName: 'Rania Haddad', photoURL: null };

const registry = buildRegistry([
  { id: 'home', label: 'Home', description: '', icon: () => null, path: 'home', order: 0, load: async () => ({ default: () => null }) },
  {
    id: 'audits',
    label: 'Unit Audits',
    description: '',
    icon: () => null,
    path: 'audits',
    order: 1,
    requires: 'audits.view',
    load: async () => ({ default: () => null }),
  },
]);

function renderWith(state: AuthState) {
  const value: AuthContextValue = {
    state,
    isSigningIn: false,
    signInError: null,
    lastSignOutReason: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    refreshAccess: vi.fn(),
  };
  return render(
    <AuthContext.Provider value={value}>
      <ModuleRegistryProvider modules={registry}>
        <MemoryRouter initialEntries={['/home']}>
          <Routes>
            <Route path="/login" element={<p>login screen</p>} />
            <Route element={<ProtectedLayout />}>
              <Route path="home" element={<p>protected content</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ModuleRegistryProvider>
    </AuthContext.Provider>,
  );
}

describe('ProtectedLayout', () => {
  it('redirects signed-out users to the login screen', () => {
    renderWith({ status: 'signedOut' });
    expect(screen.getByText('login screen')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('shows a loader while access is being verified', () => {
    renderWith({ status: 'resolving', user });
    expect(screen.getByText(/verifying your access/i)).toBeInTheDocument();
  });

  it('shows Access Pending for signed-in users awaiting approval', () => {
    renderWith({ status: 'unauthorized', user, access: 'pending' });
    expect(screen.getByRole('heading', { name: /access request sent/i })).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('shows a deactivated notice (and no retry) for revoked users', () => {
    renderWith({ status: 'unauthorized', user, access: 'disabled' });
    expect(screen.getByRole('heading', { name: /access deactivated/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /check again/i })).not.toBeInTheDocument();
  });

  it('shows a retryable error (not a lock-out) when roles cannot be loaded', () => {
    renderWith({ status: 'error', user, message: 'offline' });
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('renders the shell with role-filtered navigation for authorized users', () => {
    const roles = ['staff_nurse'] as const;
    renderWith({ status: 'authorized', user, roles: [...roles], capabilities: capabilitiesFor([...roles]) });
    expect(screen.getByText('protected content')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /home/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /unit audits/i })).not.toBeInTheDocument();
  });
});
