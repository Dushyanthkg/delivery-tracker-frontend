'use client';

import { useEffect } from 'react';
import L from 'leaflet';
import type { Map as GLMap } from 'maplibre-gl';
import { useMap } from 'react-leaflet';
import { useMyLocationStore, type MyPosition } from '@/store/useMyLocationStore';
import { maplibregl } from './maplibre';
import { mapTheme } from './theme';

/** Street-level zoom (Leaflet units) used when centring on the viewer. */
const RECENTER_ZOOM = 16;

function dotElementHtml() {
  return `<div class="my-location__inner" style="--my-location:${mapTheme.myLocation.color}">
      <div class="my-location__halo"></div><div class="my-location__dot"></div>
    </div>`;
}

/**
 * Wire a map engine to the my-location store: draw the position and fly to it
 * whenever `recenterSeq` bumps. Subscribes outside React (no re-render per fix).
 */
function bindMyLocation(draw: (p: MyPosition | null) => void, flyTo: (p: MyPosition) => void): () => void {
  const initial = useMyLocationStore.getState();
  draw(initial.position);
  let seenSeq = initial.recenterSeq; // don't fly on mount for an old request
  return useMyLocationStore.subscribe((s, prev) => {
    if (s.position !== prev.position) draw(s.position);
    if (s.recenterSeq !== seenSeq) {
      seenSeq = s.recenterSeq;
      if (s.position) flyTo(s.position);
    }
  });
}

/** 2D (Leaflet): blue dot + accuracy circle. */
export function MyLocationLayer2D() {
  const map = useMap();

  useEffect(() => {
    const color = mapTheme.myLocation.color;
    const accuracy = L.circle([0, 0], {
      radius: 1,
      color,
      weight: 1,
      opacity: 0.35,
      fillColor: color,
      fillOpacity: 0.12,
      interactive: false,
    });
    const dot = L.marker([0, 0], {
      icon: L.divIcon({ className: 'my-location', iconSize: [22, 22], iconAnchor: [11, 11], html: dotElementHtml() }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 900, // under riders (1000), over pins
    });
    let shown = false;

    const unbind = bindMyLocation(
      (p) => {
        if (!p) {
          accuracy.remove();
          dot.remove();
          shown = false;
          return;
        }
        accuracy.setLatLng([p.lat, p.lng]).setRadius(p.accuracy);
        dot.setLatLng([p.lat, p.lng]);
        if (!shown) {
          accuracy.addTo(map);
          dot.addTo(map);
          shown = true;
        }
      },
      (p) => map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), RECENTER_ZOOM), { duration: 0.8 }),
    );

    return () => {
      unbind();
      accuracy.remove();
      dot.remove();
    };
  }, [map]);

  return null;
}

/** 3D (MapLibre): blue dot that stays upright when the map is tilted. */
export function MyLocationLayer3D({ map }: { map: GLMap }) {
  useEffect(() => {
    const el = document.createElement('div');
    el.className = 'my-location';
    el.style.width = '22px';
    el.style.height = '22px';
    el.innerHTML = dotElementHtml();
    const marker = new maplibregl.Marker({ element: el, pitchAlignment: 'viewport', rotationAlignment: 'viewport' }).setLngLat([0, 0]);
    let shown = false;

    const unbind = bindMyLocation(
      (p) => {
        if (!p) {
          marker.remove();
          shown = false;
          return;
        }
        marker.setLngLat([p.lng, p.lat]);
        if (!shown) {
          marker.addTo(map);
          shown = true;
        }
      },
      // MapLibre zoom is one level below Leaflet's for the same scale.
      (p) => map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), RECENTER_ZOOM - 1), duration: 800 }),
    );

    return () => {
      unbind();
      marker.remove();
    };
  }, [map]);

  return null;
}
