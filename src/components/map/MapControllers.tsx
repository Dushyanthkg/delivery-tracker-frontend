'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap, useMapEvents } from 'react-leaflet';
import type { LatLng } from '@/services/types';

/** Re-fits the viewport whenever `fitKey` changes. */
export function FitBounds({ points, fitKey }: { points: LatLng[]; fitKey: string | number | null | undefined }) {
  const map = useMap();
  const pointsRef = useRef(points);
  useEffect(() => {
    pointsRef.current = points;
  });

  useEffect(() => {
    const pts = pointsRef.current;
    if (fitKey == null || pts.length === 0) return;
    if (pts.length === 1) {
      map.setView([pts[0]!.lat, pts[0]!.lng], Math.max(map.getZoom(), 15));
      return;
    }
    map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng])), { padding: [48, 48], maxZoom: 16 });
  }, [map, fitKey]);

  return null;
}

/**
 * Leaflet caches its container size. Recalculate when the container resizes
 * and when a route hidden by Next's <Activity> becomes visible again.
 */
export function InvalidateSizeOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(container);
    const t = setTimeout(() => map.invalidateSize({ pan: false }), 0);
    return () => {
      observer.disconnect();
      clearTimeout(t);
    };
  }, [map]);
  return null;
}

export function MapEvents({
  onClick,
  onUserDrag,
  onViewChange,
}: {
  onClick?: (p: LatLng) => void;
  onUserDrag?: () => void;
  onViewChange?: (view: { center: LatLng; zoom: number }) => void;
}) {
  const map = useMapEvents({
    click: (e) => onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
    dragstart: () => onUserDrag?.(),
    moveend: () => {
      const c = map.getCenter();
      onViewChange?.({ center: { lat: c.lat, lng: c.lng }, zoom: map.getZoom() });
    },
  });
  return null;
}
