import type { LatLng } from '@/services/types';

const R = 6_371_008.8;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing a → b, degrees clockwise from north. */
export function bearing(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Linear interpolation — accurate enough for the ~25 m hops between GPS ticks. */
export function lerpLatLng(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/** Interpolate angles along the shortest arc (350° → 10° turns 20°, not 340°). */
export function lerpAngle(from: number, to: number, t: number): number {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return (from + delta * t + 360) % 360;
}

/** Point `distance` metres from `p` along `bearingDeg`. */
export function offsetPoint(p: LatLng, distance: number, bearingDeg: number): LatLng {
  const δ = distance / R;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(p.lat);
  const λ1 = toRad(p.lng);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: toDeg(φ2), lng: ((toDeg(λ2) + 540) % 360) - 180 };
}

/** Straight line a → b with a point every `stepM` metres. */
export function densifyLine(a: LatLng, b: LatLng, stepM = 25): LatLng[] {
  const steps = Math.max(1, Math.ceil(haversine(a, b) / stepM));
  return Array.from({ length: steps + 1 }, (_, i) => lerpLatLng(a, b, i / steps));
}

/** Index of the polyline vertex closest to p. */
export function nearestVertexIndex(points: readonly LatLng[], p: LatLng): number {
  let best = 0;
  let bestD = Infinity;
  points.forEach((q, i) => {
    const d = haversine(p, q);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

export interface PathIndex {
  points: LatLng[];
  cumulative: number[];
  total: number;
}

export function buildPathIndex(points: LatLng[]): PathIndex {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1]! + haversine(points[i - 1]!, points[i]!));
  return { points, cumulative, total: cumulative.at(-1) ?? 0 };
}

/** Position and heading `distance` metres along the path (clamped to its ends). */
export function pointAlong(path: PathIndex, distance: number): { position: LatLng; heading: number } {
  const { points, cumulative, total } = path;
  if (points.length === 1) return { position: points[0]!, heading: 0 };
  const d = Math.max(0, Math.min(total, distance));
  let i = 1;
  while (i < cumulative.length - 1 && cumulative[i]! < d) i++;
  const a = points[i - 1]!;
  const b = points[i]!;
  const segLen = cumulative[i]! - cumulative[i - 1]!;
  const t = segLen === 0 ? 0 : (d - cumulative[i - 1]!) / segLen;
  return { position: lerpLatLng(a, b, t), heading: bearing(a, b) };
}

/**
 * Closest point on the path to `p`: how far along the path it is and how far
 * `p` is from the path (metres). Local equirectangular projection — accurate to
 * well under 1% at city scale.
 */
export function projectOntoPath(path: PathIndex, p: LatLng): { distance: number; offset: number } {
  const { points, cumulative } = path;
  if (points.length < 2) return { distance: 0, offset: points[0] ? haversine(points[0], p) : Infinity };
  const cosLat = Math.cos(toRad(p.lat));
  const px = p.lng * cosLat;
  const py = p.lat;
  let best = { distance: 0, offset: Infinity };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const ax = a.lng * cosLat, ay = a.lat;
    const dx = b.lng * cosLat - ax, dy = b.lat - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    const offset = haversine(p, { lat: ay + t * dy, lng: (ax + t * dx) / cosLat });
    if (offset < best.offset) {
      best = { distance: cumulative[i - 1]! + t * (cumulative[i]! - cumulative[i - 1]!), offset };
    }
  }
  return best;
}
