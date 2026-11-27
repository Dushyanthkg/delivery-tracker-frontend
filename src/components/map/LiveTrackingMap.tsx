'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, LocateFixed } from 'lucide-react';
import { config } from '@/lib/config';
import { cn } from '@/lib/cn';
import type { LatLng } from '@/services/types';
import type { LiveTrackingMapProps, MapView } from './map.types';
import { SmoothRiderMarker } from './SmoothRiderMarker';
import { RoutePolyline } from './RoutePolyline';
import { PlaceMarker } from './PlaceMarker';
import { MapRoot } from './MapRoot';
import { BaseLayer } from './BaseLayer';
import { MapStylePanel } from './MapStylePanel';
import { Map3D } from './Map3D';
import { LocateButton } from './LocateButton';
import { MyLocationLayer2D } from './MyLocation';
import { retainMyLocation } from '@/store/useMyLocationStore';
import { useTrackingStore } from '@/store/useTrackingStore';
import { useEffectiveMapStyle, useMapPrefsStore, type MapLayerId } from '@/store/useMapPrefsStore';
import { FitBounds, InvalidateSizeOnResize, MapEvents } from './MapControllers';

/**
 * Reusable Leaflet map (OpenStreetMap tiles — no API key, no billing).
 * Loaded client-only via `components/map/index.tsx`.
 *
 * Props describe *static-ish* layers (route, pins). Live rider positions are
 * read from the tracking store by SmoothRiderMarker, so this component does
 * not re-render on GPS ticks.
 */
export default function LiveTrackingMap({
  className,
  center = config.defaultCenter,
  zoom = 13,
  route,
  places = [],
  riderIds = [],
  followRiderId = null,
  fitKey,
  onMapClick,
  onRiderClick,
}: LiveTrackingMapProps) {
  const [followDisabled, setFollowDisabled] = useState(false);
  const following = !!followRiderId && !followDisabled;

  const styleId = useEffectiveMapStyle();
  const layers = useMapPrefsStore((s) => s.layers);
  const view3d = useMapPrefsStore((s) => s.view3d);
  /** Camera handed between 2D and 3D when the viewer switches. */
  const viewRef = useRef<MapView | null>(null);
  const breakFollow = () => followRiderId && setFollowDisabled(true);

  // Keep the viewer's location watch alive only while a map is on screen.
  useEffect(() => retainMyLocation(), []);

  const hasRoute = !!route && route.length > 1;
  // Draft pins (e.g. the customer placing an order) are never hidden.
  const hasToggleablePlaces = places.some((p) => p.kind !== 'draft');
  const availableLayers: MapLayerId[] = [
    ...(riderIds.length ? (['riders'] as const) : []),
    ...(hasRoute ? (['route'] as const) : []),
    ...(hasToggleablePlaces ? (['places'] as const) : []),
  ];
  const visiblePlaces = layers.places ? places : places.filter((p) => p.kind === 'draft');

  const fitPoints = useMemo<LatLng[]>(
    () => [...(route ?? []), ...places.map((p) => p.position)],
    [route, places],
  );

  return (
    <div className={cn('relative isolate h-full w-full overflow-hidden', className)}>
      {view3d ? (
        <Map3D
          styleId={styleId}
          center={center}
          zoom={zoom}
          viewRef={viewRef}
          route={route ?? null}
          showRoute={layers.route}
          places={visiblePlaces}
          riderIds={layers.riders ? riderIds : []}
          followRiderId={following ? followRiderId : null}
          fitPoints={fitPoints}
          fitKey={fitKey}
          onMapClick={onMapClick}
          onRiderClick={onRiderClick}
          onUserDrag={breakFollow}
        />
      ) : (
        <MapRoot
          center={[center.lat, center.lng]}
          zoom={zoom}
          viewRef={viewRef}
          className="h-full w-full"
          zoomControl={false}
          attributionControl
          preferCanvas
        >
          <BaseLayer styleId={styleId} />
          <InvalidateSizeOnResize />
          <MyLocationLayer2D />
          <FitBounds points={fitPoints} fitKey={fitKey} />
          <MapEvents
            onClick={onMapClick}
            onUserDrag={breakFollow}
            onViewChange={(v) => {
              viewRef.current = v;
            }}
          />

          {hasRoute && layers.route && <RoutePolyline points={route} />}
          {visiblePlaces.map((p) => (
            <PlaceMarker key={p.id} place={p} />
          ))}
          {layers.riders && riderIds.map((id) => (
            <SmoothRiderMarker key={id} riderId={id} follow={following && id === followRiderId} onClick={onRiderClick} />
          ))}
        </MapRoot>
      )}

      <MapStylePanel availableLayers={availableLayers} leading={<LocateButton onLocate={breakFollow} />} />

      {followRiderId && (
        <FollowPill riderId={followRiderId} following={following} onToggle={() => setFollowDisabled((v) => !v)} />
      )}
    </div>
  );
}

/** "Following Riya" toggle. Reads only the rider's name, so GPS ticks don't re-render it. */
function FollowPill({ riderId, following, onToggle }: { riderId: string; following: boolean; onToggle: () => void }) {
  const name = useTrackingStore((s) => s.riders[riderId]?.name);
  const who = name?.split(' ')[0] ?? 'rider';
  return (
    <button
      type="button"
      aria-pressed={following}
      onClick={onToggle}
      className={cn(
        'absolute right-3 top-3 z-(--z-map-overlay) inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold shadow-md ring-1 ring-inset backdrop-blur-md transition-[background-color,transform] duration-(--duration-fast) active:scale-95',
        following ? 'bg-brand text-brand-fg ring-brand' : 'bg-glass text-text ring-border hover:bg-surface',
      )}
    >
      {following ? <LocateFixed aria-hidden="true" className="size-4" /> : <Crosshair aria-hidden="true" className="size-4" />}
      {following ? `Following ${who}` : `Follow ${who}`}
    </button>
  );
}
