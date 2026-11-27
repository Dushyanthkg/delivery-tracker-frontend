'use client';

import { useSyncExternalStore } from 'react';

/** matchMedia that tolerates environments without it (jsdom, very old WebViews). */
export function matchesMedia(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

export function subscribeMedia(query: string, cb: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia(query);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

/** Live media-query match; `serverValue` is used for SSR and the hydration render. */
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (cb) => subscribeMedia(query, cb),
    () => matchesMedia(query),
    () => serverValue,
  );
}
