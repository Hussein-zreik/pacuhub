import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '@/context/AuthContext';
import { LoginPage } from './LoginPage';

function renderLogin(overrides: Partial<AuthContextValue> = {}) {
  const value: AuthContextValue = {
    state: { status: 'signedOut' },
    isSigningIn: false,
    signInError: null,
    lastSignOutReason: null,
    signInWithPassword: vi.fn().mockResolvedValue(undefined),
    signInWithGoogle: vi.fn(),
    sendPasswordReset: vi.fn().mockResolvedValue(null),
    clearSignInError: vi.fn(),
    signOut: vi.fn(),
    refreshAccess: vi.fn(),
    ...overrides,
  };
  render(
    <AuthContext.Provider value={value}>
      <LoginPage />
    </AuthContext.Provider>,
  );
  return value;
}

describe('LoginPage (email + password, shared with SNV2)', () => {
  it('offers email/password and hides Google by default', () => {
    renderLogin();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByText(/same email and password you use for snv2/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument();
  });

  it('validates before calling Firebase', async () => {
    const user = userEvent.setup();
    const auth = renderLogin();
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), 'nurse@aub.edu.lb');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(screen.getByText(/enter your password/i)).toBeInTheDocument();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('signs in with the entered credentials (Enter key works)', async () => {
    const user = userEvent.setup();
    const auth = renderLogin();
    await user.type(screen.getByLabelText('Email'), 'nurse@aub.edu.lb');
    await user.type(screen.getByLabelText('Password'), 'S3cret!{Enter}');
    expect(auth.signInWithPassword).toHaveBeenCalledWith('nurse@aub.edu.lb', 'S3cret!');
  });

  it('can show and hide the password', async () => {
    const user = userEvent.setup();
    renderLogin();
    const field = screen.getByLabelText('Password');
    expect(field).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(field).toHaveAttribute('type', 'text');
  });

  it('shows the server error message', () => {
    renderLogin({ signInError: 'Email or password is incorrect.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });

  it('sends a password reset and keeps the typed email', async () => {
    const user = userEvent.setup();
    const auth = renderLogin();
    await user.type(screen.getByLabelText('Email'), 'nurse@aub.edu.lb');
    await user.click(screen.getByRole('button', { name: /forgot password/i }));
    expect(screen.getByText(/also changes your snv2 password/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('nurse@aub.edu.lb');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(auth.sendPasswordReset).toHaveBeenCalledWith('nurse@aub.edu.lb');
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });
});
