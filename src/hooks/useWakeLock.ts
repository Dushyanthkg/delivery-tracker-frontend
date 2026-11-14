'use client';

import { useEffect, useState } from 'react';

/**
 * Keeps the screen on while `enabled` (Screen Wake Lock API).
 *
 * Browsers suspend geolocation once the screen locks or the tab is backgrounded,
 * and no web API can change that — so the best a web app can do is stop the
 * phone from auto-locking mid-delivery. The browser drops the lock whenever the
 * page is hidden, so it is re-acquired each time the page becomes visible again.
 *
 * Requires a secure context (HTTPS or localhost). Supported in Chrome/Edge 84+,
 * Safari 16.4+, Firefox 126+.
 */
export function useWakeLock(enabled: boolean) {
  const [active, setActive] = useState(false);
  const [hidden, setHidden] = useState(false);
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  useEffect(() => {
    if (!enabled || !supported) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || sentinel) return;
      try {
        const s = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void s.release();
          return;
        }
        sentinel = s;
        setActive(true);
        s.addEventListener('release', () => {
          sentinel = null;
          setActive(false);
        });
      } catch {
        // Denied (e.g. battery saver, not user-activated). GPS still works while the screen is on.
        setActive(false);
      }
    };

    const onVisibility = () => {
      setHidden(document.visibilityState === 'hidden');
      void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release();
      sentinel = null;
      setActive(false);
      setHidden(false);
    };
  }, [enabled, supported]);

  return { supported, active, hidden };
}
