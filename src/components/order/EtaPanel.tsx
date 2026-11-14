'use client';

import { formatAgo, formatClock, formatDistance, formatDuration } from '@/lib/format';
import { useNow } from '@/hooks/useNow';
import { useTrackingStore } from '@/store/useTrackingStore';

/**
 * Subscribes to exactly one order's ETA, so only this panel re-renders on
 * each GPS tick — the map and the rest of the page stay untouched.
 */
export function EtaPanel({ orderId }: { orderId: string }) {
  const eta = useTrackingStore((s) => s.etas[orderId] ?? null);

  if (!eta) {
    return <p className="text-sm text-slate-500">ETA will appear once the rider starts sharing their location.</p>;
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {eta.target === 'pickup' ? 'Rider arriving at pickup in' : 'Arriving in'}
      </p>
      <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-slate-900">{formatDuration(eta.durationSeconds)}</p>
      <p className="mt-1 text-sm text-slate-600">
        {formatDistance(eta.distanceMeters)} away · ETA {formatClock(eta.arrivalAt)}
      </p>
    </div>
  );
}

/** "Last update 4s ago" for a rider — isolated so its 1 Hz clock re-renders only itself. */
export function RiderLastSeen({ riderId }: { riderId: string }) {
  const receivedAt = useTrackingStore((s) => s.riders[riderId]?.receivedAt ?? null);
  const now = useNow(1_000);
  if (!receivedAt || now == null) return <span className="text-xs text-slate-400">No location yet</span>;
  const stale = now - receivedAt > 30_000;
  return (
    <span className={stale ? 'text-xs font-medium text-amber-600' : 'text-xs text-slate-500'}>
      Location updated {formatAgo(receivedAt, now)}
    </span>
  );
}
