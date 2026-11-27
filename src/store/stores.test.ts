// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { useTrackingStore } from './useTrackingStore';
import { effectiveStyleId, useMapPrefsStore } from './useMapPrefsStore';
import { activeLegRoute, type GeoPosition, type Order, type RouteInfo } from '@/services/types';
import { getBaseStyle, mapTheme, riderColor } from '@/components/map/theme';

const at = (iso: string, lat = 12.97, lng = 77.59): GeoPosition => ({ lat, lng, timestamp: iso });

const route = (source: RouteInfo['source']): RouteInfo => ({
  polyline: [
    { lat: 12.97, lng: 77.59 },
    { lat: 12.93, lng: 77.62 },
  ],
  distanceMeters: 5200,
  durationSeconds: 780,
  source,
});

function order(id: string, overrides: Partial<Order> = {}): Order {
  return {
    id,
    code: 'DT-TEST01',
    customer: { id: 'c1', name: 'Chris', phone: null },
    rider: null,
    status: 'pending',
    pickup: { address: 'A', lat: 12.97, lng: 77.59 },
    dropoff: { address: 'B', lat: 12.93, lng: 77.62 },
    route: route('osrm'),
    pickupRoute: null,
    lastRiderLocation: null,
    eta: null,
    statusHistory: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const tracking = () => useTrackingStore.getState();

describe('useTrackingStore', () => {
  beforeEach(() => tracking().reset());

  it('ignores out-of-order GPS packets so markers never jump backwards', () => {
    tracking().upsertRiderPosition('r1', at('2026-01-01T10:00:05Z', 1), { name: 'Riya' });
    tracking().upsertRiderPosition('r1', at('2026-01-01T10:00:02Z', 2)); // late packet
    expect(tracking().riders.r1!.position!.lat).toBe(1);
    tracking().upsertRiderPosition('r1', at('2026-01-01T10:00:08Z', 3));
    expect(tracking().riders.r1).toMatchObject({ name: 'Riya', isOnline: true, position: { lat: 3 } });
  });

  it('only changes activeOrderId when the update says so', () => {
    tracking().upsertRiderPosition('r1', at('2026-01-01T10:00:00Z'), { activeOrderId: 'o1' });
    tracking().upsertRiderPosition('r1', at('2026-01-01T10:00:03Z'));
    expect(tracking().riders.r1!.activeOrderId).toBe('o1');
    tracking().upsertRiderPosition('r1', at('2026-01-01T10:00:06Z'), { activeOrderId: null });
    expect(tracking().riders.r1!.activeOrderId).toBeNull();
  });

  it('clears the ETA when an order is delivered or cancelled', () => {
    tracking().setEta('o1', { distanceMeters: 100, durationSeconds: 60, target: 'dropoff', arrivalAt: '2026-01-01T10:01:00Z' });
    tracking().upsertOrder(order('o1', { status: 'in_transit' }));
    expect(tracking().etas.o1).not.toBeNull();
    tracking().upsertOrder(order('o1', { status: 'delivered' }));
    expect(tracking().etas.o1).toBeNull();
  });

  it('applies route updates to the right leg, and ignores unknown orders', () => {
    tracking().upsertOrder(order('o1', { status: 'assigned' }));
    tracking().applyRouteUpdate({ orderId: 'o1', leg: 'pickup', route: route('ors'), reason: 'assigned' });
    expect(tracking().orders.o1!.pickupRoute!.source).toBe('ors');
    expect(tracking().orders.o1!.route!.source).toBe('osrm');
    expect(activeLegRoute(tracking().orders.o1!)!.source).toBe('ors'); // assigned → pickup leg

    const before = tracking().orders;
    tracking().applyRouteUpdate({ orderId: 'nope', leg: 'dropoff', route: route('ors'), reason: 'off_route' });
    expect(tracking().orders).toBe(before);
  });

  it('removes finished dispatch searches', () => {
    tracking().setDispatchStatus({ orderId: 'o1', state: 'offered', riderId: 'r1', attempts: 0 });
    expect(tracking().dispatch.o1!.state).toBe('offered');
    tracking().setDispatchStatus({ orderId: 'o1', state: 'done', attempts: 1 });
    expect(tracking().dispatch.o1).toBeUndefined();
  });

  it('hydrates the fleet without losing a fresher live position', () => {
    tracking().upsertRiderPosition('r1', at('2026-01-01T10:05:00Z', 5));
    tracking().hydrateFleet({
      riders: [
        { rider: { id: 'r1', name: 'Riya', phone: null }, isOnline: true, location: { lat: 1, lng: 1 }, lastLocationAt: '2026-01-01T10:00:00Z', activeOrderId: 'o1' },
        { rider: { id: 'r2', name: 'Ravi', phone: null }, isOnline: false, location: { lat: 2, lng: 2 }, lastLocationAt: '2026-01-01T09:00:00Z', activeOrderId: null },
      ],
      activeOrders: [order('o1', { status: 'assigned', eta: { distanceMeters: 1, durationSeconds: 1, target: 'pickup', arrivalAt: 'x' } })],
      unassignedOrders: [order('o2')],
    });
    const s = tracking();
    expect(s.riders.r1!.position!.lat).toBe(5); // kept the live one
    expect(s.riders.r1!.activeOrderId).toBe('o1');
    expect(s.riders.r2).toMatchObject({ isOnline: false, position: { lat: 2, timestamp: '2026-01-01T09:00:00Z' } });
    expect(Object.keys(s.orders).sort()).toEqual(['o1', 'o2']);
    expect(s.etas.o1!.target).toBe('pickup');
  });
});

describe('useMapPrefsStore', () => {
  const STORAGE_KEY = 'dt-map-prefs';
  beforeEach(() => localStorage.clear());

  it('restores saved preferences, dropping styles that no longer exist and filling new layers', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { styleId: 'retired-style', layers: { riders: false }, view3d: 'yes' }, version: 1 }),
    );
    await useMapPrefsStore.persist.rehydrate();
    const s = useMapPrefsStore.getState();
    expect(s.styleId).toBe(mapTheme.defaultStyle);
    expect(s.layers).toEqual({ riders: false, route: true, places: true });
    expect(s.view3d).toBe(false); // only a real `true` turns 3D on
  });

  it('keeps a valid saved style and saves changes', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { styleId: 'dark', view3d: true }, version: 1 }));
    await useMapPrefsStore.persist.rehydrate();
    expect(useMapPrefsStore.getState()).toMatchObject({ styleId: 'dark', view3d: true });

    useMapPrefsStore.getState().toggleLayer('route');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).state.layers.route).toBe(false);
  });

  it('treats a non-default style saved before styleChosen existed as a manual pick', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { styleId: 'satellite' }, version: 1 }));
    await useMapPrefsStore.persist.rehydrate();
    expect(useMapPrefsStore.getState().styleChosen).toBe(true);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { styleId: mapTheme.defaultStyle }, version: 1 }));
    await useMapPrefsStore.persist.rehydrate();
    expect(useMapPrefsStore.getState().styleChosen).toBe(false);
  });

  it('follows the app theme until the viewer picks a style', () => {
    expect(effectiveStyleId(mapTheme.defaultStyle, false, 'light')).toBe(mapTheme.defaultStyle);
    expect(effectiveStyleId(mapTheme.defaultStyle, false, 'dark')).toBe(mapTheme.defaultDarkStyle);
    expect(effectiveStyleId('streets', true, 'dark')).toBe('streets');

    useMapPrefsStore.getState().setStyle('streets');
    expect(useMapPrefsStore.getState()).toMatchObject({ styleId: 'streets', styleChosen: true });
    useMapPrefsStore.getState().resetStyle();
    expect(useMapPrefsStore.getState().styleChosen).toBe(false);
  });
});

describe('map theme', () => {
  it('falls back to the default style for unknown ids', () => {
    expect(getBaseStyle('satellite').id).toBe('satellite');
    expect(getBaseStyle('nope').id).toBe(mapTheme.defaultStyle);
    expect(getBaseStyle(undefined).id).toBe(mapTheme.defaultStyle);
  });

  it('gives each rider a stable colour from the palette', () => {
    expect(riderColor('rider-abc')).toBe(riderColor('rider-abc'));
    expect(mapTheme.rider.palette).toContain(riderColor('rider-abc'));
    const colours = new Set(Array.from({ length: 40 }, (_, i) => riderColor(`rider-${i}`)));
    expect(colours.size).toBeGreaterThan(3);
  });
});
