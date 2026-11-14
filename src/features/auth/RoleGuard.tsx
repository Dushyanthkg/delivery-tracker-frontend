'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { homeFor } from '@/lib/routes';
import { FullPageSpinner } from '@/components/ui/Spinner';
import type { UserRole } from '@/services/types';

/**
 * Client-side route guard. (The API enforces authorisation regardless —
 * this is purely UX: redirect to login or to the user's own area.)
 */
export function RoleGuard({ roles, children }: { roles: readonly UserRole[]; children: ReactNode }) {
  const router = useRouter();
  const { hydrated, token, user, logoutReason } = useAuthStore();
  const allowed = !!token && !!user && roles.includes(user.role);

  useEffect(() => {
    if (!hydrated) return;
    if (!token || !user) {
      // Deliberate logout → plain login. Expired session → come back here after login.
      router.replace(logoutReason === 'user' ? '/login' : `/login?next=${encodeURIComponent(window.location.pathname)}`);
    } else if (!roles.includes(user.role)) {
      router.replace(homeFor(user.role));
    }
  }, [hydrated, token, user, logoutReason, roles, router]);

  if (!hydrated || !allowed) return <FullPageSpinner />;
  return <>{children}</>;
}
