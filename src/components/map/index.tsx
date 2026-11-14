'use client';

import dynamic from 'next/dynamic';
import type { LiveTrackingMapProps } from './map.types';

export type { LiveTrackingMapProps, MapPlace } from './map.types';

/** Leaflet touches `window` on import, so the map is client-only. */
export const LiveTrackingMap = dynamic<LiveTrackingMapProps>(() => import('./LiveTrackingMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
      Loading map…
    </div>
  ),
});
