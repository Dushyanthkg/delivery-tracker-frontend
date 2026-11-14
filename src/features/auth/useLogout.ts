'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { destroySocket } from '@/services/socket';
import { useAuthStore } from '@/store/useAuthStore';
import { useTrackingStore } from '@/store/useTrackingStore';

export function useLogout() {
  const router = useRouter();
  return useCallback(() => {
    destroySocket();
    useTrackingStore.getState().reset();
    useTrackingStore.getState().setConnection('idle');
    useAuthStore.getState().logout('user');
    router.replace('/login');
  }, [router]);
}
