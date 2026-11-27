'use client';

import { useEffect } from 'react';
import { THEME_STORAGE_KEY } from '@/lib/theme';
import { subscribeMedia } from '@/hooks/useMediaQuery';
import { useThemeStore } from '@/store/useThemeStore';

/** Hydrates the theme store and follows OS / other-tab changes. Renders nothing. */
export function ThemeSync() {
  useEffect(() => {
    const { hydrate, syncSystem } = useThemeStore.getState();
    hydrate();
    const onStorage = (e: StorageEvent) => e.key === THEME_STORAGE_KEY && hydrate();
    const unsubscribe = subscribeMedia('(prefers-color-scheme: dark)', syncSystem);
    window.addEventListener('storage', onStorage);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return null;
}
