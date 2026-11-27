'use client';

import dynamic from 'next/dynamic';
import type { LiveTrackingMapProps } from './map.types';

export type { LiveTrackingMapProps, MapPlace } from './map.types';

/** Leaflet touches `window` on import, so the map is client-only. */
export const LiveTrackingMap = dynamic<LiveTrackingMapProps>(() => import('./LiveTrackingMap'), {
  ssr: false,
  loading: () => (
    <div role="status" className="relative h-full w-full overflow-hidden bg-surface-muted">
      <span className="sr-only">Loading map…</span>
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-shimmer bg-[length:200%_100%] bg-[linear-gradient(90deg,transparent_25%,color-mix(in_oklch,var(--text)_5%,transparent)_50%,transparent_75%)]"
      />
    </div>
  ),
});
