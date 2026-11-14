'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { homeFor } from '@/lib/routes';
import { FullPageSpinner } from '@/components/ui/Spinner';

export function HomeRedirect() {
  const router = useRouter();
  const { hydrated, user } = useAuthStore();
  useEffect(() => {
    if (hydrated) router.replace(user ? homeFor(user.role) : '/login');
  }, [hydrated, user, router]);
  return <FullPageSpinner />;
}
