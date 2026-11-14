'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LiveTrackingMap, type MapPlace } from '@/components/map';
import { AppShell } from '@/components/ui/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Alert, Select } from '@/components/ui/Field';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EtaPanel } from '@/components/order/EtaPanel';
import { StatusStepper } from '@/components/order/StatusStepper';
import { useSocket, useOnConnect, useSocketEvent } from '@/hooks/useSocket';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useRouteSimulator } from '@/hooks/useRouteSimulator';
import { useWakeLock } from '@/hooks/useWakeLock';
import { notifyRider, useIsNativeApp } from '@/lib/native';
import { useNow } from '@/hooks/useNow';
import { emitWithAck } from '@/services/socket';
import { authApi, errorMessage, ordersApi } from '@/services/api';
import { useAuthStore } from '@/store/useAuthStore';
import { useTrackingStore } from '@/store/useTrackingStore';
import { formatDistance, formatDuration } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  ACTIVE_ORDER_STATUSES,
  activeLegRoute,
  type DispatchOffer,
  type GeoPosition,
  type OrderStatus,
} from '@/services/types';
import { buildSimulationPath } from './simulation';

type Mode = 'off' | 'gps' | 'sim';

/** Loads the rider's active orders into the store; resolves to the first order id. */
async function fetchActiveOrders(): Promise<string | null> {
  const orders = await ordersApi.list({ status: [...ACTIVE_ORDER_STATUSES], limit: 5 });
  const s = useTrackingStore.getState();
  s.upsertOrders(orders);
  orders.forEach((o) => s.setEta(o.id, o.eta));
  return orders[0]?.id ?? null;
}

const NEXT_ACTION: Partial<Record<OrderStatus, { status: OrderStatus; label: string; variant: 'primary' | 'success' }>> = {
  assigned: { status: 'picked_up', label: 'Confirm pickup', variant: 'primary' },
  picked_up: { status: 'in_transit', label: 'Head to drop-off', variant: 'primary' },
  in_transit: { status: 'delivered', label: 'Mark as delivered', variant: 'success' },
};

export function RiderDashboardView() {
  const socket = useSocket();
  const user = useAuthStore((s) => s.user)!;
  const [orderId, setOrderId] = useState<string | null>(null);
  const order = useTrackingStore((s) => (orderId ? s.orders[orderId] : undefined));
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(user.isOnline);
  const [mode, setMode] = useState<Mode>('off');
  const [notice, setNotice] = useState<{ tone: 'error' | 'info' | 'success'; text: string } | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [offer, setOffer] = useState<DispatchOffer | null>(null);
  const [offerPending, setOfferPending] = useState(false);

  /* ---------------- Data ---------------- */

  const loadActiveOrder = useCallback(() => {
    return fetchActiveOrders()
      .then((firstId) => setOrderId(firstId))
      .catch((err) => setNotice({ tone: 'error', text: errorMessage(err) }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchActiveOrders()
      .then((firstId) => !cancelled && setOrderId(firstId))
      .catch((err) => !cancelled && setNotice({ tone: 'error', text: errorMessage(err) }))
      .finally(() => !cancelled && setLoading(false));
    // Refresh profile so the online toggle reflects the server, not a stale cache.
    authApi
      .me()
      .then((me) => {
        useAuthStore.getState().setUser(me);
        if (!cancelled) setIsOnline(me.isOnline);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Seed own marker from last known server position.
  useEffect(() => {
    if (order?.lastRiderLocation && !useTrackingStore.getState().riders[user.id]?.position) {
      useTrackingStore.getState().upsertRiderPosition(user.id, order.lastRiderLocation, { name: user.name });
    }
  }, [order?.lastRiderLocation, user.id, user.name]);

  useSocketEvent(socket, 'order_assigned', ({ order: o }) => {
    useTrackingStore.getState().upsertOrder(o);
    setOrderId((cur) => cur ?? o.id);
    setNotice({ tone: 'success', text: `New order assigned: ${o.code}` });
  });

  /* ---------------- Auto-dispatch offers ---------------- */

  useSocketEvent(socket, 'dispatch_offer', (o) => {
    setOffer(o);
    void notifyRider('New delivery request', `${o.order.pickup.address} · ${formatDuration(o.pickupDurationSeconds)} away`);
  });

  useSocketEvent(socket, 'dispatch_offer_cancelled', ({ offerId, reason }) => {
    setOffer((cur) => {
      if (cur?.offerId !== offerId) return cur;
      if (reason !== 'expired') setNotice({ tone: 'info', text: 'That order was taken or cancelled.' });
      return null;
    });
  });

  async function respondToOffer(accept: boolean) {
    if (!socket || !offer) return;
    setOfferPending(true);
    const res = await emitWithAck(socket, 'dispatch_offer_respond', { offerId: offer.offerId, accept });
    setOfferPending(false);
    setOffer(null);
    if (!res.ok) {
      setNotice({ tone: 'error', text: res.error.message });
    } else if (res.data.order) {
      useTrackingStore.getState().upsertOrder(res.data.order);
      setOrderId(res.data.order.id);
      setNotice({ tone: 'success', text: `Accepted ${res.data.order.code} — head to pickup.` });
    }
  }

  useSocketEvent(socket, 'order_route_updated', (m) => useTrackingStore.getState().applyRouteUpdate(m));

  useSocketEvent(socket, 'order_status_changed', ({ order: o }) => {
    useTrackingStore.getState().upsertOrder(o);
    const mine = o.rider?.id === user.id;
    if (o.id === orderId && (!mine || o.status === 'delivered' || o.status === 'cancelled' || o.status === 'pending')) {
      setMode('off');
      if (o.status === 'cancelled' || o.status === 'pending') {
        setNotice({ tone: 'info', text: `Order ${o.code} was ${o.status === 'pending' ? 'unassigned' : 'cancelled'}.` });
      }
      void loadActiveOrder();
    }
  });

  // Re-announce presence after reconnects.
  useOnConnect(socket, () => {
    if (socket && isOnline) void emitWithAck(socket, 'rider_set_online', { isOnline: true });
  }, [isOnline]);

  /* ---------------- Location emitting ---------------- */

  const emitLocation = useCallback(
    async (pos: GeoPosition) => {
      // Show own movement immediately (server doesn't echo to the sender).
      useTrackingStore.getState().upsertRiderPosition(user.id, pos, { name: user.name, activeOrderId: orderId });
      if (!socket?.connected) return; // socket.io buffers nothing for us here — skip stale fixes

      const activeId = order && (ACTIVE_ORDER_STATUSES as readonly string[]).includes(order.status) ? order.id : null;
      const res = await emitWithAck(socket, 'rider_location_update', { ...pos, orderId: activeId });
      if (res.ok) {
        if (activeId) useTrackingStore.getState().setEta(activeId, res.data.eta);
      } else if (res.error.code === 'ORDER_NOT_ACTIVE' || res.error.code === 'FORBIDDEN') {
        setMode('off');
        setNotice({ tone: 'info', text: res.error.message });
      } else if (res.error.code !== 'RATE_LIMITED') {
        setNotice({ tone: 'error', text: `Location update failed: ${res.error.message}` });
      }
    },
    [socket, order, orderId, user.id, user.name],
  );

  const gps = useGeolocation({ enabled: mode === 'gps', onEmit: emitLocation });
  const nativeApp = useIsNativeApp();
  // The native app tracks in the background via a foreground service; the browser needs the screen kept on.
  const wakeLock = useWakeLock(mode === 'gps' && !nativeApp);

  const simulator = useRouteSimulator({
    onEmit: emitLocation,
    onFinish: () => {
      setMode('off');
      const status = useTrackingStore.getState().orders[orderId ?? '']?.status;
      setNotice({
        tone: 'success',
        text: status === 'assigned' ? 'Arrived at pickup — confirm pickup to continue.' : 'Arrived at drop-off — mark as delivered.',
      });
    },
  });

  async function setOnline(next: boolean) {
    if (!socket) return;
    const res = await emitWithAck(socket, 'rider_set_online', { isOnline: next });
    if (res.ok) {
      setIsOnline(next);
      if (!next) stopSharing();
    } else setNotice({ tone: 'error', text: res.error.message });
  }

  function stopSharing() {
    simulator.stop();
    setMode('off');
  }

  async function startGps() {
    simulator.stop();
    if (!isOnline) await setOnline(true);
    setNotice(null);
    setMode('gps');
  }

  async function startSimulation() {
    if (!order) return;
    if (!isOnline) await setOnline(true);
    setNotice(null);
    setMode('sim');
    const current = useTrackingStore.getState().riders[user.id]?.position ?? null;
    simulator.start(buildSimulationPath(order, current));
  }

  async function advanceStatus() {
    if (!order) return;
    const next = NEXT_ACTION[order.status];
    if (!next) return;
    setActionPending(true);
    try {
      const updated = await ordersApi.updateStatus(order.id, next.status);
      useTrackingStore.getState().upsertOrder(updated);
      if (next.status === 'delivered') {
        stopSharing();
        setNotice({ tone: 'success', text: `Order ${updated.code} delivered. Nice work!` });
        void loadActiveOrder();
      } else if (mode === 'sim') {
        simulator.stop();
        setMode('off');
      }
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) });
    } finally {
      setActionPending(false);
    }
  }

  /* ---------------- Render ---------------- */

  const places = useMemo<MapPlace[]>(
    () =>
      order
        ? [
            { id: 'pickup', kind: 'pickup', position: order.pickup, label: `Pickup · ${order.pickup.address}` },
            { id: 'dropoff', kind: 'dropoff', position: order.dropoff, label: `Drop-off · ${order.dropoff.address}` },
          ]
        : [],
    [order],
  );

  if (loading) {
    return (
      <AppShell title="Rider dashboard">
        <FullPageSpinner />
      </AppShell>
    );
  }

  const nextAction = order ? NEXT_ACTION[order.status] : undefined;
  const sharing = mode !== 'off';

  return (
    <AppShell title="Rider dashboard">
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="h-[50dvh] lg:h-auto lg:flex-1">
          <LiveTrackingMap
            route={order ? (activeLegRoute(order) ?? order.route)?.polyline : null}
            places={places}
            riderIds={[user.id]}
            followRiderId={sharing ? user.id : null}
            fitKey={order?.id ?? 'none'}
          />
        </div>

        <aside className="w-full space-y-4 border-t border-slate-200 bg-slate-50 p-4 lg:w-[400px] lg:overflow-y-auto lg:border-l lg:border-t-0">
          {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

          {offer && (
            <OfferCard
              key={offer.offerId}
              offer={offer}
              pending={offerPending}
              onAccept={() => void respondToOffer(true)}
              onDecline={() => void respondToOffer(false)}
              onExpired={() => setOffer(null)}
            />
          )}

          {/* Shift */}
          <Card className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-900">{isOnline ? 'You are online' : 'You are offline'}</p>
              <p className="text-xs text-slate-500">{isOnline ? 'Visible to dispatch' : 'Go online to receive orders'}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isOnline}
              onClick={() => void setOnline(!isOnline)}
              className={cn('relative h-7 w-12 rounded-full transition', isOnline ? 'bg-emerald-500' : 'bg-slate-300')}
            >
              <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', isOnline ? 'left-6' : 'left-1')} />
            </button>
          </Card>

          {/* Active order */}
          {!order ? (
            <Card>
              <CardTitle>Active order</CardTitle>
              <p className="text-sm text-slate-500">
                No active order. Stay online and share your location — nearby orders are offered to you automatically.
              </p>
              {isOnline && (
                mode === 'gps' ? (
                  <p className="mt-3 text-xs text-emerald-700">
                    {gps.status === 'watching' ? '📡 Sharing location — waiting for orders nearby' : 'Waiting for GPS fix…'}
                  </p>
                ) : (
                  <Button className="mt-3 w-full" variant="secondary" onClick={() => void startGps()}>
                    📍 Share location to get orders
                  </Button>
                )
              )}
              {gps.error && mode === 'gps' && <div className="mt-2"><Alert>{gps.error}</Alert></div>}
            </Card>
          ) : (
            <>
              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{order.code}</span>
                  <StatusBadge status={order.status} />
                </div>
                <EtaPanel orderId={order.id} />
                <div className="mt-4 space-y-1 text-sm">
                  <p><span className="font-medium text-blue-600">Pickup:</span> {order.pickup.address}</p>
                  <p><span className="font-medium text-green-600">Drop-off:</span> {order.dropoff.address}</p>
                  <p className="text-slate-500">Customer: {order.customer.name}{order.customer.phone ? ` · ${order.customer.phone}` : ''}</p>
                  {order.route && (
                    <p className="text-slate-500">
                      Route {formatDistance(order.route.distanceMeters)} · ~{formatDuration(order.route.durationSeconds)}
                    </p>
                  )}
                  {order.notes && <p className="text-slate-500">Note: {order.notes}</p>}
                </div>
                {nextAction && (
                  <Button className="mt-4 w-full" size="lg" variant={nextAction.variant} loading={actionPending} onClick={advanceStatus}>
                    {nextAction.label}
                  </Button>
                )}
              </Card>

              {/* Location sharing */}
              <Card>
                <CardTitle>Live location</CardTitle>
                {mode === 'gps' ? (
                  <Button className="w-full" size="lg" variant="danger" onClick={stopSharing}>
                    Stop delivery tracking
                  </Button>
                ) : (
                  <Button className="w-full" size="lg" onClick={() => void startGps()} disabled={mode === 'sim'}>
                    ▶ Start Delivery (device GPS)
                  </Button>
                )}
                {mode === 'gps' && (
                  <p className="mt-2 text-xs text-slate-500">
                    {gps.status === 'watching' ? '📡 Streaming GPS every 3–5 s (or after 10 m of movement)' : 'Waiting for GPS fix…'}
                    {wakeLock.active && ' · 🔆 Screen kept on'}
                  </p>
                )}
                {mode === 'gps' && nativeApp && gps.status === 'watching' && (
                  <p className="mt-1 text-xs text-slate-500">
                    🔒 Keeps tracking with the screen locked — stop it here when the delivery is done.
                  </p>
                )}
                {mode === 'gps' && !nativeApp && !wakeLock.active && (
                  <p className="mt-1 text-xs text-amber-600">
                    Keep this page open with the screen on — tracking pauses if the phone locks or you switch apps.
                  </p>
                )}
                {gps.error && mode === 'gps' && (
                  <div className="mt-2 space-y-2">
                    <Alert>{gps.error}</Alert>
                    {nativeApp && gps.status === 'denied' && (
                      <Button className="w-full" variant="secondary" onClick={gps.openSettings}>
                        Open app settings
                      </Button>
                    )}
                  </div>
                )}

                <div className="my-4 flex items-center gap-2 text-xs text-slate-400">
                  <span className="h-px flex-1 bg-slate-200" /> desktop testing <span className="h-px flex-1 bg-slate-200" />
                </div>

                <div className="flex gap-2">
                  {mode === 'sim' ? (
                    <Button className="flex-1" variant="secondary" onClick={stopSharing}>
                      ■ Stop simulation
                    </Button>
                  ) : (
                    <Button className="flex-1" variant="secondary" onClick={() => void startSimulation()} disabled={mode === 'gps'}>
                      🛵 Simulate Rider Route
                    </Button>
                  )}
                  <Select
                    aria-label="Simulation speed"
                    className="!w-20"
                    value={simulator.multiplier}
                    onChange={(e) => simulator.setMultiplier(Number(e.target.value))}
                  >
                    {[1, 3, 10].map((m) => (
                      <option key={m} value={m}>{m}×</option>
                    ))}
                  </Select>
                </div>
                {mode === 'sim' && (
                  <div className="mt-3">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full bg-indigo-600 transition-all duration-1000" style={{ width: `${Math.round(simulator.progress * 100)}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {order.status === 'assigned' ? 'Driving to pickup' : 'Driving to drop-off'} · {Math.round(simulator.progress * 100)}%
                    </p>
                  </div>
                )}
              </Card>

              <Card>
                <CardTitle>Progress</CardTitle>
                <StatusStepper order={order} />
              </Card>
            </>
          )}
        </aside>
      </div>
    </AppShell>
  );
}

/** Incoming job offer with an accept countdown (the server moves it to the next rider at 0). */
function OfferCard({
  offer,
  pending,
  onAccept,
  onDecline,
  onExpired,
}: {
  offer: DispatchOffer;
  pending: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onExpired: () => void;
}) {
  const now = useNow(500);
  const left = now == null ? null : Math.max(0, Math.ceil((Date.parse(offer.expiresAt) - now) / 1000));

  useEffect(() => {
    if (left === 0) onExpired();
  }, [left, onExpired]);

  const o = offer.order;
  return (
    <Card className="ring-2 ring-indigo-500">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-slate-900">New delivery request</span>
        {left != null && <span className="text-sm font-bold tabular-nums text-indigo-600">{left}s</span>}
      </div>
      {left != null && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${Math.min(100, (left / Math.max(1, offer.timeoutSeconds)) * 100)}%` }}
          />
        </div>
      )}
      <div className="space-y-1 text-sm">
        <p><span className="font-medium text-blue-600">Pickup:</span> {o.pickup.address}</p>
        <p><span className="font-medium text-green-600">Drop-off:</span> {o.dropoff.address}</p>
        <p className="text-slate-500">
          {formatDistance(offer.pickupDistanceMeters)} to pickup · ~{formatDuration(offer.pickupDurationSeconds)}
          {o.route && <> · trip {formatDistance(o.route.distanceMeters)}</>}
        </p>
      </div>
      <div className="mt-4 flex gap-2">
        <Button className="flex-1" variant="secondary" onClick={onDecline} disabled={pending}>
          Decline
        </Button>
        <Button className="flex-1" variant="success" onClick={onAccept} loading={pending}>
          Accept
        </Button>
      </div>
    </Card>
  );
}
