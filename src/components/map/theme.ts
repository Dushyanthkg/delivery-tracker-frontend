import type { PlaceKind } from './map.types';

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  Map theme — the one place to customise how every map in the app looks.
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  • `styles`     base maps offered in the on-map style switcher
 *  • `brand`      colours applied to the "Brand" vector style at runtime
 *  • `rider`      rider marker colour(s) and vehicle glyph
 *  • `places`     pickup / drop-off / order pin colours and glyphs
 *  • `route`      route line colour, casing and width
 *  • `myLocation` colour of the viewer's own blue dot
 *
 *  Viewers pick a style and toggle layers from the map; their choice is kept
 *  per browser (see store/useMapPrefsStore). `defaultStyle` is what a new
 *  viewer sees.
 *
 *  Want a fully custom design (fonts, which roads/POIs show, etc.)? Build a
 *  style in MapTiler / Stadia / Maputnik and set NEXT_PUBLIC_MAP_BRAND_STYLE_URL
 *  — the Brand option then uses your style as-is instead of recolouring.
 */

export type MapStyleId = 'brand' | 'streets' | 'light' | 'dark' | 'satellite' | 'classic';

export type BaseStyle =
  | {
      id: MapStyleId;
      label: string;
      kind: 'vector';
      /** MapLibre style JSON URL. */
      styleUrl: string;
      attribution: string;
      /** Apply `mapTheme.brand` colours on top of the style. */
      recolor?: boolean;
      dark?: boolean;
      /** Swatch shown in the switcher. */
      swatch: string;
    }
  | {
      id: MapStyleId;
      label: string;
      kind: 'raster';
      url: string;
      attribution: string;
      maxZoom: number;
      dark?: boolean;
      swatch: string;
    };

export type RiderVehicle = 'arrow' | 'car' | 'dot';

const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const OFM = `<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> ${OSM}`;

const customBrandStyle = process.env.NEXT_PUBLIC_MAP_BRAND_STYLE_URL?.trim();

export const mapTheme = {
  defaultStyle: 'brand' as MapStyleId,

  /** Colours for the Brand style (ignored when a custom brand style URL is set). */
  brand: {
    background: '#f1f5f9',
    water: '#c7d2fe',
    park: '#d9f99d',
    building: '#e2e8f0',
    roadMajor: '#ffffff',
    roadMinor: '#ffffff',
    roadCasing: '#cbd5e1',
    rail: '#94a3b8',
    label: '#334155',
    labelHalo: '#ffffff',
  },

  styles: [
    {
      id: 'brand',
      label: 'Brand',
      kind: 'vector',
      styleUrl: customBrandStyle || 'https://tiles.openfreemap.org/styles/positron',
      attribution: customBrandStyle ? OSM : OFM,
      recolor: !customBrandStyle,
      swatch: 'linear-gradient(135deg,#f1f5f9 50%,#c7d2fe 50%)',
    },
    {
      id: 'streets',
      label: 'Streets',
      kind: 'vector',
      styleUrl: 'https://tiles.openfreemap.org/styles/liberty',
      attribution: OFM,
      swatch: 'linear-gradient(135deg,#f8f4f0 50%,#fcd34d 50%)',
    },
    {
      id: 'light',
      label: 'Light',
      kind: 'vector',
      styleUrl: 'https://tiles.openfreemap.org/styles/positron',
      attribution: OFM,
      swatch: 'linear-gradient(135deg,#fafafa 50%,#d4d4d8 50%)',
    },
    {
      id: 'dark',
      label: 'Dark',
      kind: 'vector',
      styleUrl: 'https://tiles.openfreemap.org/styles/dark',
      attribution: OFM,
      dark: true,
      swatch: 'linear-gradient(135deg,#18181b 50%,#3f3f46 50%)',
    },
    {
      id: 'satellite',
      label: 'Satellite',
      kind: 'raster',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
      maxZoom: 19,
      dark: true,
      swatch: 'linear-gradient(135deg,#365314 50%,#78716c 50%)',
    },
    {
      id: 'classic',
      label: 'Classic',
      kind: 'raster',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: OSM,
      maxZoom: 19,
      swatch: 'linear-gradient(135deg,#f2efe9 50%,#aad3df 50%)',
    },
  ] satisfies BaseStyle[] as BaseStyle[],

  rider: {
    /** 'per-rider' gives each rider a stable colour from `palette`. */
    colorMode: 'per-rider' as 'single' | 'per-rider',
    color: '#4f46e5',
    palette: ['#4f46e5', '#db2777', '#0891b2', '#ea580c', '#7c3aed', '#059669', '#ca8a04', '#dc2626'],
    offlineColor: '#94a3b8',
    vehicle: 'arrow' as RiderVehicle,
  },

  places: {
    pickup: { color: '#2563eb', glyph: 'P' },
    dropoff: { color: '#16a34a', glyph: 'D' },
    order: { color: '#f59e0b', glyph: '•' },
    draft: { color: '#64748b', glyph: '+' },
  } satisfies Record<PlaceKind, { color: string; glyph: string }>,

  /** The viewer's own position ("current location" button). */
  myLocation: {
    color: '#1a73e8',
  },

  route: {
    color: '#4f46e5',
    casing: '#ffffff',
    weight: 5,
  },
};

export function getBaseStyle(id: string | null | undefined): BaseStyle {
  return (
    mapTheme.styles.find((s) => s.id === id) ??
    mapTheme.styles.find((s) => s.id === mapTheme.defaultStyle) ??
    mapTheme.styles[0]!
  );
}

/** Stable colour for a rider (same rider → same colour on every screen). */
export function riderColor(riderId: string): string {
  const { colorMode, color, palette } = mapTheme.rider;
  if (colorMode === 'single' || palette.length === 0) return color;
  let h = 0;
  for (let i = 0; i < riderId.length; i++) h = (h * 31 + riderId.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length]!;
}
