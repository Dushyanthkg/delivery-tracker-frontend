'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Map as LeafletMap, type MapOptions } from 'leaflet';
import { LeafletContext, createLeafletContext, type LeafletContextInterface } from '@react-leaflet/core';
import type { MapView } from './map.types';

type MapRootProps = MapOptions & {
  center: [number, number];
  zoom: number;
  className?: string;
  children?: ReactNode;
  /** If set when the map is created, start from this camera (e.g. handed over from the 3D view). */
  viewRef?: { current: MapView | null };
};

/**
 * Drop-in replacement for react-leaflet's <MapContainer>.
 *
 * MapContainer creates the Leaflet map once (in a ref callback) but removes it
 * in an effect cleanup, so when React re-runs effects on the same instance it
 * renders children against a destroyed map ("Cannot read properties of
 * undefined (reading 'appendChild')" / "Map container is being reused").
 * That happens in dev Strict Mode and whenever Cache Components' <Activity>
 * hides and re-shows a route.
 *
 * Here the map's whole lifecycle lives in one effect: each run builds a fresh
 * map on a fresh inner <div>, and cleanup tears both down. Children (layers,
 * useMap hooks) unmount before the map is removed and remount with the new one.
 * Options are read on creation only, same as MapContainer.
 */
export function MapRoot({ center, zoom, className, children, viewRef, ...options }: MapRootProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [context, setContext] = useState<LeafletContextInterface | null>(null);

  // Snapshot initial props for the effect without making it depend on them.
  const initRef = useRef({ center, zoom, options, viewRef });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const el = document.createElement('div');
    el.style.height = '100%';
    el.style.width = '100%';
    host.appendChild(el);

    const { center: c, zoom: z, options: o, viewRef: v } = initRef.current;
    const start = v?.current;
    const map = new LeafletMap(el, o).setView(start ? [start.center.lat, start.center.lng] : c, start ? start.zoom : z);
    setContext(createLeafletContext(map));

    return () => {
      setContext(null);
      map.remove();
      el.remove();
    };
  }, []);

  return (
    <div ref={hostRef} className={className}>
      {context && <LeafletContext value={context}>{children}</LeafletContext>}
    </div>
  );
}
