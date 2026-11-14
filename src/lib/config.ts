import type { LatLng } from '@/services/types';

function parseCenter(raw: string | undefined): LatLng {
  const [lat, lng] = (raw ?? '').split(',').map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat: lat!, lng: lng! } : { lat: 12.9716, lng: 77.5946 };
}

/**
 * Backend URL. Set NEXT_PUBLIC_API_URL in production. When unset, the browser
 * uses the host it loaded the page from on port 4000 — so localhost, a LAN IP
 * (phone / Android app on Wi-Fi) and a changed Wi-Fi IP all work without edits.
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined') return `${window.location.protocol}//${window.location.hostname}:4000`;
  return 'http://localhost:4000';
}

export const config = {
  apiUrl: resolveApiUrl(),
  defaultCenter: parseCenter(process.env.NEXT_PUBLIC_DEFAULT_CENTER),
  /** GPS emit policy (see useGeolocation). */
  gps: { minIntervalMs: 3_000, maxIntervalMs: 5_000, minDistanceM: 10 },
  /** Duration of marker glide between ticks; matches the GPS emit cadence. */
  markerAnimationMs: 3_000,
} as const;
