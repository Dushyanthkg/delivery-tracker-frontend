'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { useMyLocationStore } from '@/store/useMyLocationStore';
import { mapTheme } from './theme';

const LABEL: Record<string, string> = {
  idle: 'Show my location',
  locating: 'Finding your location…',
  active: 'Centre on my location',
};

/** "Current location" button: shows the viewer's blue dot and centres the map on it. */
export function LocateButton({ onLocate }: { onLocate?: () => void }) {
  const status = useMyLocationStore((s) => s.status);
  const message = useMyLocationStore((s) => s.message);
  const locate = useMyLocationStore((s) => s.locate);
  // Errors show for a few seconds, then hide until the next attempt.
  const [dismissed, setDismissed] = useState<string | null>(null);
  const showMessage = !!message && message !== dismissed;
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setDismissed(message), 5_000);
    return () => clearTimeout(t);
  }, [message]);

  const failed = status === 'denied' || status === 'unavailable' || status === 'error';
  const label = failed ? (message ?? 'Location unavailable') : LABEL[status];

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => {
          setDismissed(null);
          onLocate?.();
          locate();
        }}
        className={cn(
          'grid h-[30px] w-[30px] place-items-center rounded-full bg-white shadow-md transition hover:bg-slate-50',
          failed ? 'text-rose-500' : 'text-slate-700',
        )}
        style={status === 'active' ? { color: mapTheme.myLocation.color } : undefined}
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={status === 'locating' ? 'animate-spin [animation-duration:1.4s]' : undefined}
        >
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2.5" fill={status === 'active' ? 'currentColor' : 'none'} />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      </button>

      {showMessage && (
        <p role="alert" className="absolute bottom-full right-0 mb-2 w-56 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
          {message}
        </p>
      )}
    </div>
  );
}
