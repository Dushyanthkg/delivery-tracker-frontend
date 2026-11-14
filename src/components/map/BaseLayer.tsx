'use client';

import { useEffect } from 'react';
import L from 'leaflet';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { applyBrandColors } from './maplibre';
import { useMap } from 'react-leaflet';
import { getBaseStyle, type MapStyleId } from './theme';

/**
 * The base map under all markers. Swaps between raster tiles and MapLibre
 * vector styles (rendered inside Leaflet via maplibre-gl-leaflet, so markers,
 * the smooth rider animation and all react-leaflet layers are unchanged).
 */
export function BaseLayer({ styleId }: { styleId: MapStyleId }) {
  const map = useMap();

  useEffect(() => {
    const style = getBaseStyle(styleId);
    const container = map.getContainer();
    container.dataset.mapStyle = style.id;
    container.classList.toggle('map-dark', !!style.dark);

    let layer: L.Layer;
    if (style.kind === 'raster') {
      layer = L.tileLayer(style.url, { attribution: style.attribution, maxZoom: style.maxZoom }).addTo(map);
    } else {
      const gl: L.MaplibreGL = maplibreGL({
        style: style.styleUrl,
        // The plugin surfaces this in Leaflet's attribution control.
        attributionControl: { customAttribution: style.attribution },
      });
      gl.addTo(map);
      if (style.recolor) {
        const glMap = gl.getMaplibreMap();
        glMap.once('style.load', () => applyBrandColors(glMap));
      }
      layer = gl;
    }

    return () => {
      layer.remove();
    };
  }, [map, styleId]);

  return null;
}
