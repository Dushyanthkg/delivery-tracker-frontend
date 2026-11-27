'use client';

import { useEffect, useRef, useState } from 'react';
import { Navigation, Radio } from 'lucide-react';
import { formatAgo, formatClock, formatDistance, formatDuration } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useNow } from '@/hooks/useNow';
import { useTrackingStore } from '@/store/useTrackingStore';

/**
 * Subscribes to exactly one order's ETA, so only this panel re-renders on
 * each GPS tick — the map and the rest of the page stay untouched.
 *
 * Pass the leg lengths to show a "distance covered" progress bar.
 */
export function EtaPanel({
  orderId,
  pickupMeters,
  dropoffMeters,
  size = 'hero',
}: {
  orderId: string;
  /** Length of the rider → pickup leg, if known. */
  pickupMeters?: number | null;
  /** Length of the pickup → drop-off leg, if known. */
  dropoffMeters?: number | null;
  size?: 'hero' | 'compact';
}) {
  const eta = useTrackingStore((s) => s.etas[orderId] ?? null);
  const announcement = useThrottled(
    eta ? `${eta.target === 'pickup' ? 'Rider reaches pickup in' : 'Arriving in'} ${formatDuration(eta.durationSeconds)}` : '',
    60_000,
  );

  if (!eta) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-surface-muted p-3.5 text-sm text-text-muted">
        <Radio aria-hidden="true" className="size-5 shrink-0 text-text-subtle" />
        ETA will appear once the rider starts sharing their location.
      </div>
    );
  }

  const total = eta.target === 'pickup' ? pickupMeters : dropoffMeters;
  // Re-routes can lengthen the remaining distance; never let the bar run backwards past 0.
  const progress = total ? Math.min(1, Math.max(0, 1 - eta.distanceMeters / Math.max(total, eta.distanceMeters))) : null;
  const hero = size === 'hero';

  return (
    <div>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
      <p className="text-sm font-medium text-text-muted">{eta.target === 'pickup' ? 'Rider arriving at pickup in' : 'Arriving in'}</p>
      <div className="mt-0.5 flex items-end justify-between gap-3">
        <p className={cn('font-bold leading-none tracking-tight tabular-nums text-text', hero ? 'text-5xl' : 'text-3xl')}>
          {formatDuration(eta.durationSeconds)}
        </p>
        <p className="pb-0.5 text-right text-sm text-text-muted">
          ETA <span className="font-semibold tabular-nums text-text">{formatClock(eta.arrivalAt)}</span>
        </p>
      </div>
      {progress != null && (
        <div
          role="progressbar"
          aria-label={eta.target === 'pickup' ? 'Progress to pickup' : 'Progress to drop-off'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="mt-4 h-2 overflow-hidden rounded-full bg-surface-muted"
        >
          <div
            className="h-full origin-left rounded-full bg-brand transition-transform duration-1000 ease-out"
            style={{ transform: `scaleX(${Math.max(0.03, progress)})` }}
          />
        </div>
      )}
      <p className="mt-2 flex items-center gap-1.5 text-sm text-text-muted">
        <Navigation aria-hidden="true" className="size-3.5 text-brand-text" />
        <span className="tabular-nums">{formatDistance(eta.distanceMeters)}</span> to {eta.target === 'pickup' ? 'pickup' : 'you'}
      </p>
    </div>
  );
}

/** Returns `value`, but changes at most once per `ms` (for polite live-region announcements). */
function useThrottled(value: string, ms: number): string {
  const [shown, setShown] = useState(value);
  const last = useRef(0);
  useEffect(() => {
    const wait = Math.max(0, last.current + ms - Date.now());
    const t = setTimeout(() => {
      last.current = Date.now();
      setShown(value);
    }, wait);
    return () => clearTimeout(t);
  }, [value, ms]);
  return shown;
}

/** "Location updated 4s ago" for a rider — isolated so its 1 Hz clock re-renders only itself. */
export function RiderLastSeen({ riderId, prefix = 'Location updated' }: { riderId: string; prefix?: string }) {
  const receivedAt = useTrackingStore((s) => s.riders[riderId]?.receivedAt ?? null);
  const now = useNow(1_000);
  if (!receivedAt || now == null) return <span className="text-xs text-text-subtle">No location yet</span>;
  const stale = now - receivedAt > 30_000;
  return (
    <span className={stale ? 'text-xs font-medium text-warning-text' : 'text-xs text-text-muted'}>
      {prefix} {formatAgo(receivedAt, now)}
    </span>
  );
}
