'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useMapPrefsStore, type MapLayerId } from '@/store/useMapPrefsStore';
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

  const styleId = useMapPrefsStore((s) => s.styleId);
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
        <button
          type="button"
          onClick={() => setFollowDisabled((v) => !v)}
          className={cn(
            'absolute right-3 top-3 z-[1000] rounded-full px-3 py-1.5 text-xs font-semibold shadow-md transition',
            following ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50',
          )}
        >
          {following ? '◎ Following rider' : '◎ Follow rider'}
        </button>
      )}
    </div>
  );
}
