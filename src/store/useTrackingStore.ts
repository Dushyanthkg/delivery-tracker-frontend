'use client';

import { create } from 'zustand';
import type {
  DispatchStatusBroadcast,
  EtaInfo,
  FleetSnapshot,
  GeoPosition,
  Order,
  OrderRouteUpdatedBroadcast,
} from '@/services/types';

/**
 * High-frequency live state, isolated from React UI components.
 *
 * - Map markers read positions imperatively via `useTrackingStore.subscribe`
 *   and move Leaflet layers directly → zero React re-renders per GPS tick.
 * - UI panels subscribe with narrow selectors (e.g. a single order's ETA), so
 *   only the tiny component showing that value re-renders.
 */

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'unauthorized';

export interface LiveRider {
  riderId: string;
  name: string;
  isOnline: boolean;
  position: GeoPosition | null;
  activeOrderId: string | null;
  /** Local receipt time (epoch ms) — used for "last seen" and animation timing. */
  receivedAt: number | null;
}

interface TrackingState {
  connection: ConnectionStatus;
  riders: Record<string, LiveRider>;
  etas: Record<string, EtaInfo | null>;
  orders: Record<string, Order>;
  /** Admin: auto-dispatch progress per pending order. */
  dispatch: Record<string, DispatchStatusBroadcast>;

  setConnection: (status: ConnectionStatus) => void;
  upsertRiderPosition: (
    riderId: string,
    position: GeoPosition,
    extra?: Partial<Pick<LiveRider, 'name' | 'activeOrderId'>>,
  ) => void;
  setRiderPresence: (riderId: string, name: string, isOnline: boolean) => void;
  setEta: (orderId: string, eta: EtaInfo | null) => void;
  upsertOrder: (order: Order) => void;
  upsertOrders: (orders: Order[]) => void;
  /** Apply a re-route / pickup-leg route to an order already in the store. */
  applyRouteUpdate: (msg: OrderRouteUpdatedBroadcast) => void;
  setDispatchStatus: (status: DispatchStatusBroadcast) => void;
  hydrateFleet: (snapshot: FleetSnapshot) => void;
  reset: () => void;
}

const emptyRider = (riderId: string, name = 'Rider'): LiveRider => ({
  riderId,
  name,
  isOnline: true,
  position: null,
  activeOrderId: null,
  receivedAt: null,
});

export const useTrackingStore = create<TrackingState>()((set) => ({
  connection: 'idle',
  riders: {},
  etas: {},
  orders: {},
  dispatch: {},

  setConnection: (connection) => set({ connection }),

  upsertRiderPosition: (riderId, position, extra) =>
    set((s) => {
      const prev = s.riders[riderId] ?? emptyRider(riderId, extra?.name);
      // Ignore out-of-order packets so markers never jump backwards.
      if (prev.position && Date.parse(prev.position.timestamp) > Date.parse(position.timestamp)) return s;
      return {
        riders: {
          ...s.riders,
          [riderId]: {
            ...prev,
            ...(extra?.name ? { name: extra.name } : {}),
            ...(extra && 'activeOrderId' in extra ? { activeOrderId: extra.activeOrderId ?? null } : {}),
            isOnline: true,
            position,
            receivedAt: Date.now(),
          },
        },
      };
    }),

  setRiderPresence: (riderId, name, isOnline) =>
    set((s) => ({
      riders: { ...s.riders, [riderId]: { ...(s.riders[riderId] ?? emptyRider(riderId, name)), name, isOnline } },
    })),

  setEta: (orderId, eta) => set((s) => ({ etas: { ...s.etas, [orderId]: eta } })),

  upsertOrder: (order) =>
    set((s) => {
      const terminal = order.status === 'delivered' || order.status === 'cancelled';
      return {
        orders: { ...s.orders, [order.id]: order },
        etas: terminal ? { ...s.etas, [order.id]: null } : s.etas,
      };
    }),

  upsertOrders: (orders) =>
    set((s) => ({ orders: { ...s.orders, ...Object.fromEntries(orders.map((o) => [o.id, o])) } })),

  applyRouteUpdate: ({ orderId, leg, route }) =>
    set((s) => {
      const order = s.orders[orderId];
      if (!order) return s;
      const next = leg === 'pickup' ? { ...order, pickupRoute: route } : { ...order, route };
      return { orders: { ...s.orders, [orderId]: next } };
    }),

  setDispatchStatus: (status) =>
    set((s) => {
      if (status.state === 'done') {
        const rest = { ...s.dispatch };
        delete rest[status.orderId];
        return { dispatch: rest };
      }
      return { dispatch: { ...s.dispatch, [status.orderId]: status } };
    }),

  hydrateFleet: ({ riders, activeOrders, unassignedOrders, dispatch = [] }) =>
    set((s) => {
      const next: Record<string, LiveRider> = {};
      for (const r of riders) {
        const live = s.riders[r.rider.id];
        next[r.rider.id] = {
          riderId: r.rider.id,
          name: r.rider.name,
          isOnline: r.isOnline,
          activeOrderId: r.activeOrderId,
          // Keep a fresher live position if we already have one.
          position:
            live?.position ??
            (r.location ? { ...r.location, timestamp: r.lastLocationAt ?? new Date(0).toISOString() } : null),
          receivedAt: live?.receivedAt ?? (r.lastLocationAt ? Date.parse(r.lastLocationAt) : null),
        };
      }
      const orders = [...activeOrders, ...unassignedOrders];
      return {
        riders: next,
        orders: Object.fromEntries(orders.map((o) => [o.id, o])),
        etas: Object.fromEntries(activeOrders.map((o) => [o.id, o.eta])),
        dispatch: Object.fromEntries(dispatch.map((d) => [d.orderId, d])),
      };
    }),

  reset: () => set({ riders: {}, etas: {}, orders: {}, dispatch: {} }),
}));
