'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, errorMessage } from '@/services/api';
import { useAuthStore } from '@/store/useAuthStore';
import { homeFor } from '@/lib/routes';
import { Button } from '@/components/ui/Button';
import { Alert, Field, Input, Select } from '@/components/ui/Field';
import type { SelfRegisterRole } from '@/services/types';

const DEMO_ACCOUNTS = [
  { label: 'Customer', email: 'customer@demo.com' },
  { label: 'Rider', email: 'rider@demo.com' },
  { label: 'Admin', email: 'admin@demo.com' },
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

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-indigo-600 font-bold text-white">DT</span>
          <h1 className="text-2xl font-bold text-slate-900">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-1 text-sm text-slate-500">Real-time delivery tracking</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          {error && <Alert>{error}</Alert>}
          {mode === 'register' && (
            <>
              <Field label="Full name">
                <Input required minLength={2} value={form.name} onChange={update('name')} autoComplete="name" />
              </Field>
              <Field label="I am a">
                <Select value={form.role} onChange={update('role')}>
                  <option value="customer">Customer</option>
                  <option value="rider">Delivery rider</option>
                </Select>
              </Field>
              <Field label="Phone (optional)">
                <Input type="tel" value={form.phone} onChange={update('phone')} autoComplete="tel" />
              </Field>
            </>
          )}
          <Field label="Email">
            <Input type="email" required value={form.email} onChange={update('email')} autoComplete="email" />
          </Field>
          <Field label="Password" hint={mode === 'register' ? 'At least 8 characters' : undefined}>
            <Input
              type="password"
              required
              minLength={mode === 'register' ? 8 : 1}
              value={form.password}
              onChange={update('password')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </Field>
          <Button type="submit" className="w-full" loading={submitting}>
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
          <p className="text-center text-sm text-slate-500">
            {mode === 'login' ? (
              <>No account? <Link className="font-semibold text-indigo-600" href="/register">Register</Link></>
            ) : (
              <>Have an account? <Link className="font-semibold text-indigo-600" href="/login">Sign in</Link></>
            )}
          </p>
        </form>

        {mode === 'login' && (
          <div className="mt-4 rounded-xl bg-white/70 p-3 text-center ring-1 ring-slate-200">
            <p className="mb-2 text-xs text-slate-500">Demo accounts (password Password123!)</p>
            <div className="flex justify-center gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <Button
                  key={a.email}
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, email: a.email, password: 'Password123!' }))}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
