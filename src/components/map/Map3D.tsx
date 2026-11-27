'use client';

import { useEffect, useRef, useState } from 'react';
import type { GeoJSONSource, Map as GLMap } from 'maplibre-gl';
import type { LatLng } from '@/services/types';
import type { MapPlace, MapView } from './map.types';
import { applyBrandColors, ensure3DBuildings, maplibregl, toMaplibreStyle } from './maplibre';
import { getBaseStyle, mapTheme, riderColor, type MapStyleId } from './theme';
import { placeMarkerHtml, riderMarkerHtml } from './icons';
import { startRiderGlide } from './riderGlide';
import { MyLocationLayer3D } from './MyLocation';
import { mapInsets } from './insets';

/** MapLibre uses 512px tiles, so its zoom is one level below Leaflet's for the same scale. */
const toGLZoom = (leafletZoom: number) => leafletZoom - 1;
const toLeafletZoom = (glZoom: number) => glZoom + 1;

const ROUTE_SOURCE = 'dt-route';
const ROUTE_LAYERS = ['dt-route-casing', 'dt-route-line'] as const;

interface Map3DProps {
  styleId: MapStyleId;
  center: LatLng;
  zoom: number;
  /** Read once on creation: where the 2D view left the camera. */
  viewRef: { current: MapView | null };
  route: LatLng[] | null;
  showRoute: boolean;
  places: MapPlace[];
  riderIds: string[];
  followRiderId: string | null;
  fitPoints: LatLng[];
  fitKey: string | number | null | undefined;
  onMapClick?: (p: LatLng) => void;
  onRiderClick?: (riderId: string) => void;
  onUserDrag?: () => void;
}

/**
 * Tilted 3D view (native MapLibre): pitch/rotate, extruded buildings, same
 * styles, riders, route, pins and follow behaviour as the 2D Leaflet map.
 *
 * Lifecycle mirrors MapRoot: the map is created in an effect on a fresh inner
 * <div> and fully removed in cleanup, so React Strict Mode and Cache
 * Components' <Activity> hide/show never touch a destroyed map.
 */
export function Map3D(props: Map3DProps) {
  const { styleId, route, showRoute, places, riderIds, followRiderId, fitKey } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<GLMap | null>(null);

  // Latest values for map event handlers / style reloads, without re-creating the map.
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  // ── create / destroy ────────────────────────────────────────────────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.inset = '0';
    host.appendChild(el);

    const p = latest.current;
    const start = p.viewRef.current ?? { center: p.center, zoom: p.zoom };
    const style = getBaseStyle(p.styleId);
    const m = new maplibregl.Map({
      container: el,
      style: toMaplibreStyle(style),
      center: [start.center.lng, start.center.lat],
      zoom: toGLZoom(start.zoom),
      pitch: 60,
      bearing: -20,
      maxPitch: 75,
      attributionControl: { compact: false },
    });
    m.getContainer().dataset.mapStyle = style.id;
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    // Re-apply our additions every time a style (re)loads.
    m.on('style.load', () => {
      const s = getBaseStyle(m.getContainer().dataset.mapStyle);
      if (s.kind === 'vector' && s.recolor) applyBrandColors(m);
      ensure3DBuildings(m, s);
      syncRoute(m, latest.current.route, latest.current.showRoute);
    });
    m.on('click', (e) => latest.current.onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    m.on('dragstart', () => latest.current.onUserDrag?.());
    m.on('moveend', () => {
      const c = m.getCenter();
      latest.current.viewRef.current = { center: { lat: c.lat, lng: c.lng }, zoom: toLeafletZoom(m.getZoom()) };
    });

    setMap(m);
    return () => {
      setMap(null);
      m.remove();
      el.remove();
    };
  }, []);

  // ── base style ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map) return;
    const style = getBaseStyle(styleId);
    const container = map.getContainer();
    if (container.dataset.mapStyle === style.id) return;
    container.dataset.mapStyle = style.id;
    map.setStyle(toMaplibreStyle(style), { diff: false });
  }, [map, styleId]);

  // ── route ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return; // style.load handler covers the initial sync
    syncRoute(map, route ?? null, showRoute);
  }, [map, route, showRoute]);

  // ── fit to route + pins when fitKey changes ─────────────────────────────
  useEffect(() => {
    if (!map) return;
    const pts = latest.current.fitPoints;
    if (fitKey == null || pts.length === 0) return;
    if (pts.length === 1) {
      map.jumpTo({ center: [pts[0]!.lng, pts[0]!.lat], zoom: Math.max(map.getZoom(), 15) });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    for (const p of pts) bounds.extend([p.lng, p.lat]);
    const inset = mapInsets(map.getContainer());
    map.fitBounds(bounds, {
      padding: { top: 64, right: 64, left: 64 + inset.left, bottom: 64 + inset.bottom },
      maxZoom: 16,
      pitch: map.getPitch(),
      bearing: map.getBearing(),
      duration: 0,
    });
  }, [map, fitKey]);

  // ── pins ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map) return;
    const created = places.map((place) => {
      const el = document.createElement('div');
      el.className = `place-marker${place.selected ? ' place-marker--selected' : ''}`;
      el.innerHTML = placeMarkerHtml(place.kind);
      if (place.onClick) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', place.onClick);
      }
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, 2] })
        .setLngLat([place.position.lng, place.position.lat])
        .addTo(map);
      const detachTooltip = place.label ? attachTooltip(map, el, () => marker.getLngLat(), place.label, 38) : null;
      return { marker, detachTooltip };
    });
    return () => {
      for (const { marker, detachTooltip } of created) {
        detachTooltip?.();
        marker.remove();
      }
    };
  }, [map, places]);

  return (
    <div ref={hostRef} className="map3d relative h-full w-full" style={{ background: getBaseStyle(styleId).dark ? '#18181b' : 'var(--surface-muted)' }}>
      {map && <MyLocationLayer3D map={map} />}
      {map &&
        riderIds.map((id) => (
          <Rider3D key={id} map={map} riderId={id} follow={followRiderId === id} onClick={props.onRiderClick} />
        ))}
    </div>
  );
}

/** One rider on the 3D map; animation shared with 2D via startRiderGlide. Renders nothing. */
function Rider3D({ map, riderId, follow, onClick }: { map: GLMap; riderId: string; follow: boolean; onClick?: (id: string) => void }) {
  const followRef = useRef(follow);
  const onClickRef = useRef(onClick);
  useEffect(() => {
    followRef.current = follow;
    onClickRef.current = onClick;
  });

  useEffect(() => {
    const el = document.createElement('div');
    el.className = 'rider-marker';
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.cursor = 'pointer';
    el.innerHTML = riderMarkerHtml(riderColor(riderId));
    el.addEventListener('click', () => onClickRef.current?.(riderId));

    // Stays upright (readable when tilted) but rotates with the map's bearing,
    // so the arrow still shows the rider's true compass heading.
    const marker = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'viewport' }).setLngLat([0, 0]);
    let name = '';
    const detachTooltip = attachTooltip(map, el, () => marker.getLngLat(), () => name, 22);

    const stop = startRiderGlide(
      riderId,
      {
        show: (pos) => marker.setLngLat([pos.lng, pos.lat]).addTo(map),
        hide: () => marker.remove(),
        setPosition: (pos) => marker.setLngLat([pos.lng, pos.lat]),
        setHeading: (deg) => marker.setRotation(deg),
        setMeta: (rider) => {
          name = rider.name;
          el.classList.toggle('is-offline', !rider.isOnline);
        },
        pan: (target, durationMs) =>
          durationMs == null
            ? map.jumpTo({ center: [target.lng, target.lat] })
            : map.easeTo({ center: [target.lng, target.lat], duration: durationMs, easing: (t) => t }),
      },
      () => followRef.current,
    );
    return () => {
      stop();
      detachTooltip();
      marker.remove();
    };
  }, [map, riderId]);

  return null;
}

/** Hover tooltip for a DOM marker (MapLibre has no Leaflet-style tooltips). */
function attachTooltip(
  map: GLMap,
  el: HTMLElement,
  getLngLat: () => maplibregl.LngLat,
  text: string | (() => string),
  offsetY: number,
) {
  const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: [0, -offsetY], className: 'map3d-tooltip' });
  const show = () => {
    const t = typeof text === 'function' ? text() : text;
    if (t) popup.setLngLat(getLngLat()).setText(t).addTo(map);
  };
  const hide = () => popup.remove();
  el.addEventListener('mouseenter', show);
  el.addEventListener('mouseleave', hide);
  return () => {
    el.removeEventListener('mouseenter', show);
    el.removeEventListener('mouseleave', hide);
    popup.remove();
  };
}

function syncRoute(map: GLMap, route: LatLng[] | null, visible: boolean) {
  const data: GeoJSON.Feature = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: (route ?? []).map((p) => [p.lng, p.lat]) },
  };
  const source = map.getSource<GeoJSONSource>(ROUTE_SOURCE);
  if (source) source.setData(data);
  else {
    map.addSource(ROUTE_SOURCE, { type: 'geojson', data });
    const { color, casing, weight } = mapTheme.route;
    map.addLayer({
      id: ROUTE_LAYERS[0],
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': casing, 'line-width': weight + 4, 'line-opacity': 0.9 },
    });
    map.addLayer({
      id: ROUTE_LAYERS[1],
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': color, 'line-width': weight, 'line-opacity': 0.95 },
    });
  }
  const show = visible && (route?.length ?? 0) > 1;
  for (const id of ROUTE_LAYERS) map.setLayoutProperty(id, 'visibility', show ? 'visible' : 'none');
}
