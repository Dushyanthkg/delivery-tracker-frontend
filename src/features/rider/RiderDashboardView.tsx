'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { LiveTrackingMap, type MapPlace } from '@/components/map';
import { AppShell } from '@/components/ui/AppShell';
import { Card, CardTitle } from '@/components/ui/Card';
import { MapScreen } from '@/components/ui/MapScreen';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { StatusStepper } from '@/components/order/StatusStepper';
import { useSocket, useOnConnect, useSocketEvent } from '@/hooks/useSocket';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useRouteSimulator } from '@/hooks/useRouteSimulator';
import { useWakeLock } from '@/hooks/useWakeLock';
import { notifyRider, useIsNativeApp } from '@/lib/native';
import { emitWithAck } from '@/services/socket';
import { authApi, errorMessage, ordersApi } from '@/services/api';
import { useAuthStore } from '@/store/useAuthStore';
import { useTrackingStore } from '@/store/useTrackingStore';
import { formatDuration } from '@/lib/format';
import {
  ACTIVE_ORDER_STATUSES,
  activeLegRoute,
  type DispatchOffer,
  type GeoPosition,
  type OrderStatus,
} from '@/services/types';
import { buildSimulationPath } from './simulation';
import { OfferCard } from './OfferCard';
import { OnlineCard } from './OnlineCard';
import { ActiveOrderDetails, ActiveOrderSummary, type NextAction } from './ActiveOrderCard';
import { TrackingControls } from './TrackingControls';
import { SimulatorPanel } from './SimulatorPanel';
import { NoOrderCard } from './NoOrderCard';

type Mode = 'off' | 'gps' | 'sim';
type Notice = { tone: 'error' | 'info' | 'success'; text: string } | null;

/**
 * Rider notices show as toasts in a single slot (same id), so each new notice
 * replaces the previous one — like the old inline banner — and null clears it.
 */
const RIDER_NOTICE = 'rider-notice';
function setNotice(n: Notice) {
  if (!n) return toast.dismiss(RIDER_NOTICE);
  const show = n.tone === 'error' ? toast.error : n.tone === 'success' ? toast.success : toast.info;
  show(n.text, { id: RIDER_NOTICE });
}

/** Loads the rider's active orders into the store; resolves to the first order id. */
async function fetchActiveOrders(): Promise<string | null> {
  const orders = await ordersApi.list({ status: [...ACTIVE_ORDER_STATUSES], limit: 5 });
  const s = useTrackingStore.getState();
  s.upsertOrders(orders);
  orders.forEach((o) => s.setEta(o.id, o.eta));
  return orders[0]?.id ?? null;
}

const NEXT_ACTION: Partial<Record<OrderStatus, NextAction>> = {
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

  const map = (
    <LiveTrackingMap
      route={order ? (activeLegRoute(order) ?? order.route)?.polyline : null}
      places={places}
      riderIds={[user.id]}
      followRiderId={mode !== 'off' ? user.id : null}
      fitKey={order?.id ?? 'none'}
    />
  );

  if (loading) {
    return (
      <AppShell title="Rider dashboard" layout="map">
        <MapScreen
          label="Rider controls"
          map={map}
          peek={
            <div role="status" className="space-y-3 py-2">
              <span className="sr-only">Loading your shift…</span>
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-14 w-full rounded-2xl" />
            </div>
          }
        />
      </AppShell>
    );
  }

  const nextAction = order ? NEXT_ACTION[order.status] : undefined;
  const offerCard = offer && (
    <OfferCard
      key={offer.offerId}
      offer={offer}
      pending={offerPending}
      onAccept={() => void respondToOffer(true)}
      onDecline={() => void respondToOffer(false)}
      onExpired={() => setOffer(null)}
    />
  );
  const onlineCard = <OnlineCard isOnline={isOnline} onChange={(next) => void setOnline(next)} />;

  return (
    <AppShell title="Rider dashboard" layout="map">
      <MapScreen
        label="Rider controls"
        map={map}
        peek={
          // Always within thumb reach: an incoming offer, or the job's next step, or going online.
          <div className="space-y-3 pb-2">
            {offerCard}
            {!offer &&
              (order ? (
                <ActiveOrderSummary order={order} nextAction={nextAction} pending={actionPending} onAdvance={() => void advanceStatus()} />
              ) : (
                onlineCard
              ))}
          </div>
        }
      >
        {(order || offer) && onlineCard}
        {!order ? (
          <NoOrderCard
            isOnline={isOnline}
            sharing={mode === 'gps'}
            watching={gps.status === 'watching'}
            gpsError={gps.error}
            onShare={() => void startGps()}
          />
        ) : (
          <>
            {offer && (
              <ActiveOrderSummary order={order} nextAction={nextAction} pending={actionPending} onAdvance={() => void advanceStatus()} />
            )}
            <ActiveOrderDetails order={order} />
            <TrackingControls
              mode={mode}
              gpsStatus={gps.status}
              gpsError={gps.error}
              nativeApp={nativeApp}
              wakeLockActive={wakeLock.active}
              onStart={() => void startGps()}
              onStop={stopSharing}
              onOpenSettings={gps.openSettings}
            />
            <SimulatorPanel
              mode={mode}
              multiplier={simulator.multiplier}
              onMultiplier={simulator.setMultiplier}
              progress={simulator.progress}
              heading={order.status === 'assigned' ? 'pickup' : 'dropoff'}
              onStart={() => void startSimulation()}
              onStop={stopSharing}
            />
            <Card>
              <CardTitle icon={<ListChecks />}>Progress</CardTitle>
              <StatusStepper order={order} />
            </Card>
          </>
        )}
      </MapScreen>
    </AppShell>
  );
}
