'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, CircleX, ListChecks, MessageCircle, Phone, ReceiptText, Search } from 'lucide-react';
import { LiveTrackingMap, type MapPlace } from '@/components/map';
import { AppShell } from '@/components/ui/AppShell';
import { buttonClasses } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Field';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { KeyValue, KeyValueList } from '@/components/ui/KeyValue';
import { MapScreen } from '@/components/ui/MapScreen';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/Toast';
import { StatusStepper } from '@/components/order/StatusStepper';
import { EtaPanel, RiderLastSeen } from '@/components/order/EtaPanel';
import { RouteVisual } from '@/components/order/RouteVisual';
import { DeliveredHero } from '@/components/order/DeliveredHero';
import { useSocket } from '@/hooks/useSocket';
import { useOrderRoom } from '@/hooks/useOrderRoom';
import { useTrackingStore } from '@/store/useTrackingStore';
import { useAuthStore } from '@/store/useAuthStore';
import { formatDistance, formatDuration, STATUS_LABELS } from '@/lib/format';
import { activeLegRoute, type Order, type OrderStatus } from '@/services/types';

const STATUS_TOAST: Partial<Record<OrderStatus, string>> = {
  assigned: 'A rider is heading to the pickup.',
  picked_up: 'Your order is with the rider.',
  in_transit: 'Your rider is on the way to you.',
  delivered: 'Your order has arrived.',
  cancelled: 'This order was cancelled.',
};

/**
 * Live tracking page. Re-renders only when the *order* changes (status,
 * assignment). GPS ticks update the marker (imperatively) and EtaPanel
 * (narrow selector) without re-rendering this tree.
 */
export function TrackOrderView({ orderId }: { orderId: string }) {
  const socket = useSocket();
  const { error } = useOrderRoom(socket, orderId);
  const order = useTrackingStore((s) => s.orders[orderId]);
  const role = useAuthStore((s) => s.user?.role);

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

  // Toast live status changes (not the initial load).
  const status = order?.status;
  const prevStatus = useRef<OrderStatus | undefined>(undefined);
  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = status;
    if (!prev || !status || prev === status) return;
    const description = STATUS_TOAST[status];
    if (status === 'cancelled') toast.error(STATUS_LABELS[status], { id: `status-${orderId}`, description });
    else toast.success(STATUS_LABELS[status], { id: `status-${orderId}`, description });
  }, [status, orderId]);

  const back = role === 'admin' ? { href: '/admin/dispatch', label: 'Dispatch' } : { href: '/customer', label: 'My deliveries' };

  if (error) {
    return (
      <AppShell title="Track order" back={back}>
        <div className="mx-auto w-full max-w-md space-y-4 p-6">
          <Alert>{error}</Alert>
          <Link href={back.href} transitionTypes={['nav-back']} className={buttonClasses({ variant: 'secondary' })}>
            <ArrowLeft aria-hidden="true" />
            Back to {back.label.toLowerCase()}
          </Link>
        </div>
      </AppShell>
    );
  }

  if (!order) {
    return (
      <AppShell title="Track order" back={back} layout="map">
        <MapScreen
          label="Order details"
          map={<div className="h-full w-full bg-surface-muted" />}
          peek={
            <div role="status" className="space-y-4 py-2">
              <span className="sr-only">Connecting to live tracking…</span>
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-12 w-40" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          }
        />
      </AppShell>
    );
  }

  const live = ['assigned', 'picked_up', 'in_transit'].includes(order.status);
  const riderId = order.rider?.id ?? null;

  return (
    <AppShell title={`Order ${order.code}`} back={back} layout="map">
      <MapScreen
        label={`Order ${order.code} details`}
        map={
          <LiveTrackingMap
            route={(activeLegRoute(order) ?? order.route)?.polyline}
            places={places}
            riderIds={riderId && live ? [riderId] : []}
            followRiderId={null}
            fitKey={order.id}
          />
        }
        peek={
          <div className="space-y-4 pb-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-sm font-medium text-text-muted">{order.code}</p>
              <StatusBadge status={order.status} size="md" />
            </div>
            <OrderHero order={order} />
          </div>
        }
      >
        {order.rider && (
          <Card className="flex items-center gap-3">
            <Avatar id={order.rider.id} name={order.rider.name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-text-muted">Your rider</p>
              <p className="truncate font-semibold text-text">{order.rider.name}</p>
              {live && riderId && <RiderLastSeen riderId={riderId} />}
            </div>
            {order.rider.phone && (
              <div className="flex gap-2">
                <IconButton href={`sms:${order.rider.phone}`} label={`Message ${order.rider.name}`} icon={<MessageCircle />} variant="secondary" />
                <IconButton href={`tel:${order.rider.phone}`} label={`Call ${order.rider.name}`} icon={<Phone />} variant="primary" />
              </div>
            )}
          </Card>
        )}

        <Card>
          <CardTitle icon={<ListChecks />}>Progress</CardTitle>
          <StatusStepper order={order} />
        </Card>

        <Card>
          <CardTitle icon={<ReceiptText />}>Details</CardTitle>
          <RouteVisual pickup={order.pickup.address} dropoff={order.dropoff.address} />
          {(order.route || order.notes) && (
            <KeyValueList className="mt-4 border-t border-border pt-3">
              {order.route && (
                <KeyValue label="Route">
                  <span className="tabular-nums">
                    {formatDistance(order.route.distanceMeters)} · ~{formatDuration(order.route.durationSeconds)}
                  </span>
                  {order.route.source === 'fallback' && <span className="block text-xs font-normal text-text-muted">Approximate</span>}
                </KeyValue>
              )}
              {order.notes && (
                <KeyValue label="Note">
                  <span className="font-normal">{order.notes}</span>
                </KeyValue>
              )}
            </KeyValueList>
          )}
        </Card>
      </MapScreen>
    </AppShell>
  );
}

/** The big top-of-sheet block: ETA, searching, delivered or cancelled. */
function OrderHero({ order }: { order: Order }) {
  switch (order.status) {
    case 'delivered':
      return <DeliveredHero deliveredAt={order.statusHistory.findLast((e) => e.status === 'delivered')?.at} />;
    case 'cancelled':
      return (
        <div className="flex items-center gap-3 rounded-2xl bg-status-cancelled-soft p-4 text-status-cancelled-text">
          <CircleX aria-hidden="true" className="size-6 shrink-0" />
          <p className="font-semibold">This order was cancelled.</p>
        </div>
      );
    case 'pending':
      return (
        <div className="flex items-center gap-3 rounded-2xl bg-brand-soft p-4">
          <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-brand text-brand-fg">
            <span aria-hidden="true" className="absolute inset-0 animate-live-ping rounded-full bg-brand/40" />
            <Search aria-hidden="true" className="relative size-5" />
          </span>
          <div>
            <p className="font-semibold text-text">Finding a rider for your order…</p>
            <p className="text-sm text-text-muted">We’re offering it to the nearest available riders.</p>
          </div>
        </div>
      );
    default:
      return <EtaPanel orderId={order.id} pickupMeters={order.pickupRoute?.distanceMeters} dropoffMeters={order.route?.distanceMeters} />;
  }
}
