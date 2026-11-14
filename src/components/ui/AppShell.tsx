'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useLogout } from '@/features/auth/useLogout';
import { homeFor } from '@/lib/routes';
import { ConnectionIndicator } from './ConnectionIndicator';
import { Button } from './Button';

export function AppShell({ title, children, showConnection = true }: { title: string; children: ReactNode; showConnection?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="sticky top-0 z-[1100] border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link href={user ? homeFor(user.role) : '/'} className="flex items-center gap-2 font-bold text-slate-900">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-sm text-white">DT</span>
            <span className="hidden sm:inline">DeliveryTrack</span>
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="truncate text-sm font-semibold text-slate-700">{title}</h1>
          <div className="ml-auto flex items-center gap-3">
            {showConnection && <ConnectionIndicator />}
            {user && (
              <span className="hidden text-right text-xs leading-tight text-slate-500 md:block">
                <span className="block font-semibold text-slate-800">{user.name}</span>
                <span className="capitalize">{user.role}</span>
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
