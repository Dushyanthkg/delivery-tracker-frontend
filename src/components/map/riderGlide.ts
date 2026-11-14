import { config } from '@/lib/config';
import {
  bearing,
  buildPathIndex,
  haversine,
  lerpAngle,
  lerpLatLng,
  pointAlong,
  projectOntoPath,
  type PathIndex,
} from '@/lib/geo';
import { useTrackingStore, type LiveRider } from '@/store/useTrackingStore';
import { activeLegRoute, type LatLng } from '@/services/types';

/** Beyond this jump (e.g. after a long disconnect) we teleport instead of gliding. */
const TELEPORT_THRESHOLD_M = 1_000;
/** Both ends within this of the route → glide ALONG the road (server-snapped fixes sit on it). */
const ON_ROUTE_M = 6;
/** Small backwards moves along the route are GPS jitter — hold still instead of reversing. */
const BACKTRACK_TOLERANCE_M = 25;

/** Prepared paths per route polyline (a new route object = a re-route → new entry). */
const pathCache = new WeakMap<LatLng[], PathIndex>();

/** Road the rider is following right now (rider → pickup, then pickup → dropoff), if it's a real road route. */
function routePathFor(rider: LiveRider): PathIndex | null {
  const order = rider.activeOrderId ? useTrackingStore.getState().orders[rider.activeOrderId] : undefined;
  const route = order ? activeLegRoute(order) : null;
  if (!route || route.source === 'fallback' || route.polyline.length < 2) return null;
  let path = pathCache.get(route.polyline);
  if (!path) {
    path = buildPathIndex(route.polyline);
    pathCache.set(route.polyline, path);
  }
  return path;
}

/** What a map engine (Leaflet 2D, MapLibre 3D) must provide to animate a rider marker. */
export interface RiderMarkerAdapter {
  /** Add the marker to the map at `pos`. */
  show(pos: LatLng): void;
  /** Remove the marker from the map. */
  hide(): void;
  setPosition(pos: LatLng): void;
  /** Compass heading in degrees (0 = north). */
  setHeading(deg: number): void;
  /** Name / online state changed. */
  setMeta(rider: LiveRider): void;
  /** Move the camera to `target`; `durationMs` null = jump instantly. */
  pan(target: LatLng, durationMs: number | null): void;
}

/**
 * Drives one rider marker from the tracking store, gliding between GPS fixes.
 *
 * Performance design: subscribes to the Zustand store directly and runs a
 * requestAnimationFrame loop that calls the adapter — no React render per
 * frame or per tick. Returns a cleanup function.
 */
export function startRiderGlide(riderId: string, marker: RiderMarkerAdapter, isFollowing: () => boolean): () => void {
  let added = false;
  let frame: number | null = null;
  let current: { pos: LatLng; heading: number } | null = null;
  let lastReceivedAt: number | null = null;

  const glideTo = (target: LatLng, targetHeading: number | null, durationMs: number, path: PathIndex | null) => {
    if (frame) cancelAnimationFrame(frame);
    const from = current!;
    const moved = haversine(from.pos, target);
    const toHeading = targetHeading ?? (moved > 2 ? bearing(from.pos, target) : from.heading);

    // Hidden tabs pause requestAnimationFrame — snap instead of queueing animations.
    if (moved > TELEPORT_THRESHOLD_M || document.hidden) {
      current = { pos: target, heading: toHeading };
      marker.setPosition(target);
      marker.setHeading(toHeading);
      if (isFollowing()) marker.pan(target, null);
      return;
    }

    // Follow the road between fixes (turns corners instead of cutting across them).
    let along: ((t: number) => { pos: LatLng; heading: number }) | null = null;
    if (path) {
      const a = projectOntoPath(path, from.pos);
      const b = projectOntoPath(path, target);
      if (a.offset <= ON_ROUTE_M && b.offset <= ON_ROUTE_M) {
        const delta = b.distance - a.distance;
        if (delta < 0 && delta > -BACKTRACK_TOLERANCE_M) return; // jitter: never moonwalk
        // Plausible forward progress only (not a jump to another part of a looping route).
        if (delta >= 0 && delta <= moved * 3 + 50) {
          along = (t) => {
            const p = pointAlong(path, a.distance + delta * t);
            return { pos: p.position, heading: p.heading };
          };
        }
      }
    }

    // Pan the camera on the same timeline as the marker for a locked-on feel.
    if (isFollowing()) marker.pan(target, durationMs);

    const start = performance.now();
    let heading = from.heading;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      let pos: LatLng;
      if (along) {
        const p = along(t);
        pos = p.pos;
        // Ease towards each segment's direction so corners turn smoothly, not in one frame.
        heading = lerpAngle(heading, p.heading, 0.2);
      } else {
        pos = lerpLatLng(from.pos, target, t);
        // Turn faster than we move so the arrow points where it's going.
        heading = lerpAngle(from.heading, toHeading, Math.min(1, t * 3));
      }
      current = { pos, heading };
      marker.setPosition(pos);
      marker.setHeading(heading);
      frame = t < 1 ? requestAnimationFrame(step) : null;
    };
    frame = requestAnimationFrame(step);
  };

  const apply = (rider: LiveRider | undefined) => {
    if (!rider?.position) {
      if (added) marker.hide();
      added = false;
      current = null;
      return;
    }
    marker.setMeta(rider);
    const target = { lat: rider.position.lat, lng: rider.position.lng };

    if (!added || !current) {
      marker.show(target);
      added = true;
      current = { pos: target, heading: rider.position.heading ?? 0 };
      marker.setHeading(current.heading);
      marker.setMeta(rider); // element exists now
      lastReceivedAt = rider.receivedAt;
      return;
    }

    // Match glide duration to the observed tick interval so motion is continuous.
    const interval = rider.receivedAt && lastReceivedAt ? rider.receivedAt - lastReceivedAt : config.markerAnimationMs;
    lastReceivedAt = rider.receivedAt;
    const duration = Math.max(300, Math.min(interval || config.markerAnimationMs, 5_000));
    glideTo(target, rider.position.heading ?? null, duration, routePathFor(rider));
  };

  apply(useTrackingStore.getState().riders[riderId]);

  const unsubscribe = useTrackingStore.subscribe((state, prev) => {
    const next = state.riders[riderId];
    const before = prev.riders[riderId];
    if (next === before) return;
    if (next && before && next.position === before.position) {
      marker.setMeta(next); // presence / name change only
      return;
    }
    apply(next);
  });

  return () => {
    unsubscribe();
    if (frame) cancelAnimationFrame(frame);
    if (added) marker.hide();
  };
}
