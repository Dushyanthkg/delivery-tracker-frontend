import L from 'leaflet';
import type { PlaceKind } from './map.types';
import { mapTheme, type RiderVehicle } from './theme';

/** All icons are DivIcons (inline SVG) — no image assets, no broken default-marker URLs. */

/** Glyphs point "up" (heading 0°); `.rider-marker__arrow` is rotated per frame by SmoothRiderMarker. */
const VEHICLE_GLYPH: Record<RiderVehicle, string> = {
  arrow: `<svg class="rider-marker__arrow" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M12 2 L19 20 L12 16 L5 20 Z" fill="currentColor"/>
    </svg>`,
  car: `<svg class="rider-marker__arrow" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <rect x="6" y="2" width="12" height="20" rx="4" fill="currentColor"/>
      <path d="M8 7.5h8l-1-3H9z M8 17h8l-1 2.5H9z" fill="var(--rider-color)" opacity=".9"/>
    </svg>`,
  dot: `<svg class="rider-marker__arrow" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor"/>
    </svg>`,
};

/** Inner HTML of a rider marker (shared by the 2D DivIcon and 3D DOM marker). */
export function riderMarkerHtml(color: string = mapTheme.rider.color, vehicle: RiderVehicle = mapTheme.rider.vehicle): string {
  return `
      <div class="rider-marker__inner" style="--rider-color:${color};--rider-offline:${mapTheme.rider.offlineColor}">
        <div class="rider-marker__pulse"></div>
        <div class="rider-marker__body">${VEHICLE_GLYPH[vehicle]}</div>
      </div>`;
}

/** Inner HTML of a place pin (30×40, tip at bottom centre). */
export function placeMarkerHtml(kind: PlaceKind): string {
  const { color, glyph } = mapTheme.places[kind];
  return `
      <svg viewBox="0 0 30 40" width="30" height="40" aria-hidden="true">
        <path d="M15 1C7.3 1 1 7.2 1 14.9 1 25.3 15 39 15 39s14-13.7 14-24.1C29 7.2 22.7 1 15 1z" fill="${color}" stroke="white" stroke-width="2"/>
        <text x="15" y="19.5" text-anchor="middle" font-size="12" font-weight="700" fill="white" font-family="system-ui, sans-serif">${glyph}</text>
      </svg>`;
}

const riderCache = new Map<string, L.DivIcon>();

export function riderIcon(color: string = mapTheme.rider.color, vehicle: RiderVehicle = mapTheme.rider.vehicle): L.DivIcon {
  const key = `${color}:${vehicle}`;
  const hit = riderCache.get(key);
  if (hit) return hit;
  const icon = L.divIcon({
    className: 'rider-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    tooltipAnchor: [0, -18],
    html: riderMarkerHtml(color, vehicle),
  });
  riderCache.set(key, icon);
  return icon;
}

const placeCache = new Map<string, L.DivIcon>();

export function placeIcon(kind: PlaceKind, selected = false): L.DivIcon {
  const key = `${kind}:${selected}`;
  const hit = placeCache.get(key);
  if (hit) return hit;
  const icon = L.divIcon({
    className: `place-marker${selected ? ' place-marker--selected' : ''}`,
    iconSize: [30, 40],
    iconAnchor: [15, 38],
    popupAnchor: [0, -34],
    tooltipAnchor: [0, -34],
    html: placeMarkerHtml(kind),
  });
  placeCache.set(key, icon);
  return icon;
}
