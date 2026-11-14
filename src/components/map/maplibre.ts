import * as maplibregl from 'maplibre-gl';
import { setWorkerUrl, type Map as GLMap, type StyleSpecification } from 'maplibre-gl';
import { mapTheme, type BaseStyle } from './theme';

// MapLibre 6 finds its worker next to its own module file, which doesn't exist
// once the bundler has inlined maplibre-gl into a chunk. Have Turbopack emit the
// (self-contained) worker as a static asset and point MapLibre at it.
setWorkerUrl(new URL('../../../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href);

export { maplibregl };

/** OpenMapTiles vector source (OpenFreeMap) — used to add 3D buildings on raster styles. */
export const OPENMAPTILES_URL = 'https://tiles.openfreemap.org/planet';

/** A style MapLibre can load directly: vector styles by URL, raster styles wrapped inline. */
export function toMaplibreStyle(style: BaseStyle): string | StyleSpecification {
  if (style.kind === 'vector') return style.styleUrl;
  return {
    version: 8,
    sources: {
      base: {
        type: 'raster',
        tiles: [style.url.replace('{s}', 'a')],
        tileSize: 256,
        maxzoom: style.maxZoom,
        attribution: style.attribution,
      },
    },
    layers: [{ id: 'base', type: 'raster', source: 'base' }],
  };
}

/**
 * Recolour a vector style with `mapTheme.brand` by matching layer ids/types.
 * Works with OpenMapTiles-schema styles (OpenFreeMap, MapTiler, Stadia...).
 */
export function applyBrandColors(glMap: GLMap) {
  const b = mapTheme.brand;
  type PaintProp = Parameters<GLMap['setPaintProperty']>[1];
  const set = (id: string, prop: PaintProp, value: string) => {
    try {
      glMap.setPaintProperty(id, prop, value);
    } catch {
      /* property not valid for this layer — skip */
    }
  };

  for (const layer of glMap.getStyle().layers ?? []) {
    const id = layer.id.toLowerCase();
    switch (layer.type) {
      case 'background':
        set(layer.id, 'background-color', b.background);
        break;
      case 'fill':
        if (/water|ocean|lake|river/.test(id)) set(layer.id, 'fill-color', b.water);
        else if (/park|grass|wood|forest|landcover|green|cemetery|pitch/.test(id)) set(layer.id, 'fill-color', b.park);
        else if (/building/.test(id)) set(layer.id, 'fill-color', b.building);
        else if (/landuse|residential|land/.test(id)) set(layer.id, 'fill-color', b.background);
        break;
      case 'fill-extrusion':
        if (/building/.test(id)) set(layer.id, 'fill-extrusion-color', b.building);
        break;
      case 'line':
        if (/water|river|stream|canal/.test(id)) set(layer.id, 'line-color', b.water);
        else if (/rail|transit/.test(id)) set(layer.id, 'line-color', b.rail);
        else if (/highway|road|street|tunnel|bridge|path|track/.test(id)) {
          if (/casing|outline/.test(id)) set(layer.id, 'line-color', b.roadCasing);
          else if (/motorway|trunk|primary|major/.test(id)) set(layer.id, 'line-color', b.roadMajor);
          else set(layer.id, 'line-color', b.roadMinor);
        }
        break;
      case 'symbol':
        if (layer.layout && 'text-field' in layer.layout) {
          set(layer.id, 'text-color', b.label);
          set(layer.id, 'text-halo-color', b.labelHalo);
        }
        break;
    }
  }
}

/**
 * Ensure the style has extruded 3D buildings. Uses the style's own
 * fill-extrusion layer if it has one; otherwise adds one from OpenMapTiles,
 * inserted below the first label layer so names stay on top.
 */
export function ensure3DBuildings(glMap: GLMap, style: BaseStyle) {
  const layers = glMap.getStyle().layers ?? [];
  if (layers.some((l) => l.type === 'fill-extrusion')) return;
  if (glMap.getLayer('dt-3d-buildings')) return;

  let sourceId = Object.entries(glMap.getStyle().sources).find(
    ([, s]) => s.type === 'vector' && 'url' in s && s.url === OPENMAPTILES_URL,
  )?.[0];
  if (!sourceId) {
    sourceId = 'dt-openmaptiles';
    if (!glMap.getSource(sourceId)) glMap.addSource(sourceId, { type: 'vector', url: OPENMAPTILES_URL });
  }

  const color = style.id === 'brand' ? mapTheme.brand.building : style.dark ? '#2a2a2e' : '#e4e4e7';
  const firstSymbol = layers.find((l) => l.type === 'symbol')?.id;
  glMap.addLayer(
    {
      id: 'dt-3d-buildings',
      type: 'fill-extrusion',
      source: sourceId,
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': color,
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, ['coalesce', ['get', 'render_height'], 6]],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': style.kind === 'raster' ? 0.85 : 0.9,
      },
    },
    // On raster styles there are no labels — append on top.
    firstSymbol,
  );
}
