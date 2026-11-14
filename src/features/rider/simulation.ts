import { densifyLine, haversine, nearestVertexIndex, offsetPoint } from '@/lib/geo';
import type { LatLng, Order } from '@/services/types';

/** How far from pickup a simulated rider starts if we have no real position. */
const APPROACH_START_M = 900;
const MAX_REASONABLE_START_M = 8_000;

/**
 * Builds the path the desktop simulator walks:
 *  - `assigned`  → along the rider → pickup road route when there is one, else a
 *                  straight line from the rider's position (or a point ~900 m away)
 *  - `picked_up` / `in_transit` → along the road polyline to drop-off, resuming
 *    from the vertex nearest the rider's current position.
 */
export function buildSimulationPath(order: Order, current: LatLng | null): LatLng[] {
  if (order.status === 'assigned') {
    const road = order.pickupRoute?.source !== 'fallback' ? order.pickupRoute?.polyline : undefined;
    if (road && road.length >= 2) {
      const rest = current ? road.slice(nearestVertexIndex(road, current)) : road;
      return rest.length >= 2 ? rest : road;
    }
    const start =
      current && haversine(current, order.pickup) < MAX_REASONABLE_START_M && haversine(current, order.pickup) > 30
        ? current
        : offsetPoint(order.pickup, APPROACH_START_M, 225);
    return densifyLine(start, order.pickup, 25);
  }

  const route = order.route?.polyline ?? densifyLine(order.pickup, order.dropoff, 25);
  if (!current) return route;
  const from = nearestVertexIndex(route, current);
  const rest = route.slice(from);
  return rest.length >= 2 ? rest : route;
}
