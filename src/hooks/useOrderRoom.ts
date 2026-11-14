'use client';

import { useState } from 'react';
import { emitWithAck, type AppSocket } from '@/services/socket';
import { useTrackingStore } from '@/store/useTrackingStore';
import { useOnConnect, useSocketEvent } from './useSocket';
import type { Order } from '@/services/types';

/**
 * Joins `order:{id}` (and re-joins after every reconnect), seeds the store
 * from the join ack and keeps it updated from live events.
 */
export function useOrderRoom(socket: AppSocket | null, orderId: string | null) {
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  useOnConnect(
    socket,
    () => {
      if (!socket || !orderId) return;
      void emitWithAck(socket, 'join_order_room', { orderId }).then((res) => {
        if (!res.ok) {
          setError(res.error.code === 'NOT_FOUND' ? 'Order not found' : res.error.message);
          return;
        }
        setError(null);
        setJoined(true);
        seedFromOrder(res.data.order);
      });
      return;
    },
    [orderId],
  );

  useSocketEvent(socket, 'rider_location_update', (msg) => {
    if (msg.orderId !== orderId) return;
    const { upsertRiderPosition, setEta } = useTrackingStore.getState();
    upsertRiderPosition(msg.riderId, msg.position, { activeOrderId: msg.orderId });
    setEta(msg.orderId, msg.eta);
  });

  useSocketEvent(socket, 'order_status_changed', (msg) => {
    if (msg.orderId === orderId) useTrackingStore.getState().upsertOrder(msg.order);
  });

  // Rider → pickup route on assignment, re-routes when the rider leaves the planned road.
  useSocketEvent(socket, 'order_route_updated', (msg) => {
    if (msg.orderId === orderId) useTrackingStore.getState().applyRouteUpdate(msg);
  });

  return { joined, error };
}

function seedFromOrder(order: Order) {
  const s = useTrackingStore.getState();
  s.upsertOrder(order);
  s.setEta(order.id, order.eta);
  if (order.rider && order.lastRiderLocation) {
    s.upsertRiderPosition(order.rider.id, order.lastRiderLocation, { name: order.rider.name, activeOrderId: order.id });
  }
}
