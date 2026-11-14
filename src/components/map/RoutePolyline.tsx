'use client';

import { useMemo } from 'react';
import { Polyline } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import type { LatLng } from '@/services/types';
import { mapTheme } from './theme';

interface Props {
  points: LatLng[];
  color?: string;
  dashed?: boolean;
}

/** Road route drawn with a white casing underneath for contrast on any tile. */
export function RoutePolyline({ points, color = mapTheme.route.color, dashed = false }: Props) {
  const { casing, weight } = mapTheme.route;
  const positions = useMemo<LatLngTuple[]>(() => points.map((p) => [p.lat, p.lng]), [points]);
  if (positions.length < 2) return null;
  return (
    <>
      <Polyline positions={positions} pathOptions={{ color: casing, weight: weight + 4, opacity: 0.9, lineCap: 'round' }} interactive={false} />
      <Polyline
        positions={positions}
        pathOptions={{ color, weight, opacity: 0.95, lineCap: 'round', lineJoin: 'round', dashArray: dashed ? '8 10' : undefined }}
        interactive={false}
      />
    </>
  );
}
