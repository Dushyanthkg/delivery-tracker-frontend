// @vitest-environment jsdom
import { Activity, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthResponse } from '@/services/types';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const login = vi.fn<(body: { email: string; password: string }) => Promise<AuthResponse>>();
vi.mock('@/services/api', () => ({
  authApi: { login: (body: { email: string; password: string }) => login(body), register: vi.fn() },
  errorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

const { AuthForm } = await import('./AuthForm');
const { useAuthStore } = await import('@/store/useAuthStore');

const RIDER: AuthResponse = {
  token: 't',
  expiresIn: 3600,
  user: { id: 'u1', name: 'Riya', email: 'rider@demo.com', role: 'rider', phone: null, isOnline: false, createdAt: '2026-01-01T00:00:00Z' },
} as AuthResponse;

/** Next keeps visited pages mounted inside <Activity> and hides them on navigation. */
function Page({ visible }: { visible: boolean }) {
  return (
    <Activity mode={visible ? 'visible' : 'hidden'}>
      <AuthForm mode="login" />
    </Activity>
  );
}

const submit = () => screen.getByRole('button', { name: /sign in/i, hidden: true }) as HTMLButtonElement;
const password = () => document.querySelector('input[type=password]') as HTMLInputElement;
const email = () => document.querySelector('input[type=email]') as HTMLInputElement;

beforeEach(() => {
  useAuthStore.setState({ token: null, user: null, expiresAt: null, hydrated: true, logoutReason: null });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AuthForm', () => {
  it('signs in and redirects to the role home', async () => {
    login.mockResolvedValue(RIDER);
    render(<Page visible />);
    fireEvent.change(email(), { target: { value: 'rider@demo.com' } });
    fireEvent.change(password(), { target: { value: 'Password123!' } });
    await act(async () => fireEvent.click(submit()));

    expect(login).toHaveBeenCalledWith({ email: 'rider@demo.com', password: 'Password123!' });
    expect(replace).toHaveBeenCalledWith('/rider/dashboard');
  });

  it('is usable again after signing in and logging out (no stuck spinner, no saved password)', async () => {
    login.mockResolvedValue(RIDER);
    const view = render(<Page visible />);
    fireEvent.change(email(), { target: { value: 'rider@demo.com' } });
    fireEvent.change(password(), { target: { value: 'Password123!' } });
    await act(async () => fireEvent.click(submit()));
    expect(submit().disabled).toBe(true); // spinner while redirecting

    // Navigate away (page hidden, not unmounted), log out, come back to /login.
    view.rerender(<Page visible={false} />);
    act(() => useAuthStore.getState().logout('user'));
    view.rerender(<Page visible />);

    expect(submit().disabled).toBe(false);
    expect(password().value).toBe('');
    expect(email().value).toBe('rider@demo.com');
  });

  it('keeps an unsent draft when the user leaves without signing in', () => {
    const view = render(<Page visible />);
    fireEvent.change(email(), { target: { value: 'draft@demo.com' } });
    fireEvent.change(password(), { target: { value: 'half-typed' } });
    view.rerender(<Page visible={false} />);
    view.rerender(<Page visible />);
    expect(email().value).toBe('draft@demo.com');
    expect(password().value).toBe('half-typed');
  });

  it('shows the error and re-enables the button when sign-in fails', async () => {
    login.mockRejectedValue(new Error('Invalid email or password'));
    render(<Page visible />);
    fireEvent.change(email(), { target: { value: 'rider@demo.com' } });
    fireEvent.change(password(), { target: { value: 'wrong' } });
    await act(async () => fireEvent.click(submit()));

    expect(screen.getByText('Invalid email or password')).toBeTruthy();
    expect(submit().disabled).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });
});
