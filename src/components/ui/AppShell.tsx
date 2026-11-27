'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useLogout } from '@/features/auth/useLogout';
import { homeFor } from '@/lib/routes';
import { cn } from '@/lib/cn';
import { ThemePicker, ThemeToggle } from '@/components/theme/ThemeToggle';
import type { User } from '@/services/types';
import { ConnectionIndicator } from './ConnectionIndicator';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { LogoMark } from './Logo';

const ROLE_LABEL: Record<User['role'], string> = { customer: 'Customer', rider: 'Rider', admin: 'Dispatcher' };

export function AppShell({
  title,
  children,
  showConnection = true,
  back,
  layout = 'page',
}: {
  title: string;
  children: ReactNode;
  showConnection?: boolean;
  /** Breadcrumb parent, e.g. { href: '/customer', label: 'My deliveries' }. */
  back?: { href: string; label: string };
  /** 'map' locks the shell to the viewport so a map screen can fill it edge to edge. */
  layout?: 'page' | 'map';
}) {
  const user = useAuthStore((s) => s.user);

  return (
    <div className={cn('flex flex-col bg-bg', layout === 'map' ? 'h-dvh overflow-hidden' : 'min-h-dvh')}>
      <header
        style={{ viewTransitionName: 'app-header' }}
        className="sticky top-0 z-(--z-header) border-b border-border bg-glass pt-(--safe-top) backdrop-blur-xl"
      >
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-2 pl-[max(1rem,var(--safe-left))] pr-[max(0.75rem,var(--safe-right))] sm:gap-3">
          <Link
            href={user ? homeFor(user.role) : '/'}
            className="flex shrink-0 items-center gap-2.5 rounded-xl"
            aria-label="DeliveryTrack home"
          >
            <LogoMark className="size-8" />
            <span className="hidden text-[15px] font-semibold tracking-tight text-text md:inline">
              Delivery<span className="text-brand-text">Track</span>
            </span>
          </Link>

          <span aria-hidden="true" className="hidden h-5 w-px bg-border sm:block" />

          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
            {back && (
              <>
                <Link
                  href={back.href}
                  transitionTypes={['nav-back']}
                  className="group flex min-h-touch min-w-8 shrink-0 items-center gap-0.5 rounded-lg pr-1 font-medium text-text-muted transition-colors hover:text-text"
                >
                  <ChevronLeft aria-hidden="true" className="size-4 transition-transform group-hover:-translate-x-0.5" />
                  <span className="hidden sm:inline">{back.label}</span>
                  <span className="sr-only sm:hidden">Back to {back.label}</span>
                </Link>
                <span aria-hidden="true" className="hidden text-text-subtle sm:inline">
                  /
                </span>
              </>
            )}
            <h1 className="truncate font-semibold text-text" aria-current="page">
              {title}
            </h1>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            {showConnection && <ConnectionIndicator />}
            <ThemeToggle />
            {user && <AccountMenu user={user} />}
          </div>
        </div>
      </header>
      <main className={cn('flex flex-1 flex-col', layout === 'map' && 'min-h-0')}>{children}</main>
    </div>
  );
}

/** Avatar button → popover with name, role, theme picker and log out. */
function AccountMenu({ user }: { user: User }) {
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Account: ${user.name}`}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 items-center gap-1 rounded-full pl-1 pr-1.5 transition-colors hover:bg-surface-muted"
      >
        <Avatar id={user.id} name={user.name} size="sm" />
        <ChevronDown aria-hidden="true" className={cn('size-4 text-text-subtle transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 top-full z-(--z-popover) mt-2 w-72 origin-top-right animate-pop-in rounded-2xl bg-surface-raised p-2 shadow-xl ring-1 ring-border"
        >
          <div className="flex items-center gap-3 p-2">
            <Avatar id={user.id} name={user.name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-text">{user.name}</p>
              <p className="truncate text-sm text-text-muted">{user.email}</p>
            </div>
          </div>
          <div className="px-2 pb-2">
            <Badge tone="brand">{ROLE_LABEL[user.role]}</Badge>
          </div>
          <div className="border-t border-border p-2">
            <p className="mb-2 text-xs font-medium text-text-muted">Appearance</p>
            <ThemePicker />
          </div>
          <div className="border-t border-border pt-2">
            <button
              type="button"
              onClick={logout}
              className="flex h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-danger-text transition-colors hover:bg-danger-soft"
            >
              <LogOut aria-hidden="true" className="size-4" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
