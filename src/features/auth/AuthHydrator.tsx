'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { destroySocket } from '@/services/socket';

/** Loads the persisted session after mount and keeps tabs in sync. */
export function AuthHydrator() {
  useEffect(() => {
    void useAuthStore.persist.rehydrate();

    // Logout / login in another tab → mirror it here.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'dt-auth') return;
      const before = useAuthStore.getState().token;
      void Promise.resolve(useAuthStore.persist.rehydrate()).then(() => {
        if (before !== useAuthStore.getState().token) destroySocket();
      });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return null;
}
