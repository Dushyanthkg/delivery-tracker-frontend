'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, errorMessage } from '@/services/api';
import { useAuthStore } from '@/store/useAuthStore';
import { homeFor } from '@/lib/routes';
import { Bike, Eye, EyeOff, Lock, Mail, Phone, ShieldCheck, User, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert, Field, Input } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { LogoMark } from '@/components/ui/Logo';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import type { SelfRegisterRole } from '@/services/types';
import { AuthBrandPanel } from './AuthBrandPanel';

const DEMO_ACCOUNTS: Array<{ label: string; email: string; icon: LucideIcon }> = [
  { label: 'Customer', email: 'customer@demo.com', icon: User },
  { label: 'Rider', email: 'rider@demo.com', icon: Bike },
  { label: 'Admin', email: 'admin@demo.com', icon: ShieldCheck },
];

/** Only allow same-site relative redirects (prevents open-redirects via ?next=). */
function safeNext(): string | null {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const { hydrated, user, setSession } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'customer' as SelfRegisterRole });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const signedIn = useRef(false);

  // Next keeps this page alive (hidden) after we navigate away, so on the way
  // out after a successful sign-in, clear the spinner and the password — otherwise
  // logging out later returns to a stuck "Sign in" button with the password filled.
  useLayoutEffect(() => {
    return () => {
      if (!signedIn.current) return;
      signedIn.current = false;
      setSubmitting(false);
      setError(null);
      setForm((f) => ({ ...f, password: '' }));
    };
  }, []);

  // Already signed in → go to your area.
  useEffect(() => {
    if (hydrated && user) router.replace(safeNext() ?? homeFor(user.role));
  }, [hydrated, user, router]);

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const auth =
        mode === 'login'
          ? await authApi.login({ email: form.email, password: form.password })
          : await authApi.register({
              name: form.name,
              email: form.email,
              password: form.password,
              role: form.role,
              ...(form.phone ? { phone: form.phone } : {}),
            });
      signedIn.current = true;
      setSession(auth); // effect above redirects
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  const linkClass = 'rounded font-semibold text-brand-text underline-offset-4 hover:underline';

  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <AuthBrandPanel />

      <div className="relative flex flex-col items-center justify-center px-4 pb-10 pt-[calc(var(--safe-top)+4.5rem)] sm:px-6">
        {/* Soft brand glow on phones, where the brand panel is hidden */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(70%_100%_at_50%_0%,color-mix(in_oklch,var(--brand)_14%,transparent),transparent)] lg:hidden" />
        <div className="absolute right-3 top-[calc(var(--safe-top)+0.75rem)]">
          <ThemeToggle />
        </div>

        <div className="relative w-full max-w-sm animate-slide-up">
          <div className="mb-8">
            <LogoMark className="mb-6 size-11 lg:hidden" />
            <h1 className="text-3xl font-semibold tracking-tight text-text">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
            <p className="mt-2 text-text-muted">
              {mode === 'login' ? 'Sign in to follow, ride or dispatch deliveries in real time.' : 'Real-time delivery tracking'}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            {mode === 'register' && (
              <>
                <Field label="Full name">
                  <Input required minLength={2} value={form.name} onChange={update('name')} autoComplete="name" leading={<User className="text-text-subtle" />} />
                </Field>
                <div className="space-y-1.5">
                  <span id="role-label" className="text-sm font-medium text-text">
                    I am a
                  </span>
                  <SegmentedControl
                    aria-label="I am a"
                    className="flex w-full"
                    value={form.role}
                    onChange={(role) => setForm((f) => ({ ...f, role }))}
                    options={[
                      { value: 'customer', label: (<><User aria-hidden="true" />Customer</>) },
                      { value: 'rider', label: (<><Bike aria-hidden="true" />Delivery rider</>) },
                    ]}
                  />
                </div>
                <Field label="Phone (optional)">
                  <Input type="tel" value={form.phone} onChange={update('phone')} autoComplete="tel" leading={<Phone className="text-text-subtle" />} />
                </Field>
              </>
            )}
            <Field label="Email">
              <Input
                type="email"
                required
                value={form.email}
                onChange={update('email')}
                autoComplete="email"
                placeholder="you@example.com"
                leading={<Mail className="text-text-subtle" />}
              />
            </Field>
            <Field label="Password" hint={mode === 'register' ? 'At least 8 characters' : undefined}>
              <Input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={mode === 'register' ? 8 : 1}
                value={form.password}
                onChange={update('password')}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                leading={<Lock className="text-text-subtle" />}
                trailing={
                  <IconButton
                    size="sm"
                    tooltip={false}
                    label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    icon={showPassword ? <EyeOff /> : <Eye />}
                    onClick={() => setShowPassword((v) => !v)}
                  />
                }
              />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={submitting}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
            <p className="text-center text-sm text-text-muted">
              {mode === 'login' ? (
                <>No account? <Link className={linkClass} href="/register">Register</Link></>
              ) : (
                <>Have an account? <Link className={linkClass} href="/login">Sign in</Link></>
              )}
            </p>
          </form>

          {mode === 'login' && (
            <section aria-labelledby="demo-title" className="mt-8 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-border">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 id="demo-title" className="text-sm font-semibold text-text">
                  Try a demo account
                </h2>
                <p className="text-xs text-text-muted">
                  password <span className="font-mono">Password123!</span>
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map(({ label, email, icon: Icon }) => {
                  const selected = form.email === email;
                  return (
                    <button
                      key={email}
                      type="button"
                      aria-pressed={selected}
                      title={email}
                      onClick={() => setForm((f) => ({ ...f, email, password: 'Password123!' }))}
                      className={
                        selected
                          ? 'flex min-h-touch flex-col items-center gap-1.5 rounded-xl bg-brand-soft px-2 py-3 text-xs font-semibold text-brand-text ring-2 ring-brand transition-[transform,background-color] duration-(--duration-fast) active:scale-95'
                          : 'flex min-h-touch flex-col items-center gap-1.5 rounded-xl bg-surface-muted px-2 py-3 text-xs font-semibold text-text ring-1 ring-inset ring-border transition-[transform,background-color] duration-(--duration-fast) hover:bg-surface hover:ring-border-strong active:scale-95'
                      }
                    >
                      <Icon aria-hidden="true" className="size-5" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
