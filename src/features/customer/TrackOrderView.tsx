'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { LiveTrackingMap, type MapPlace } from '@/components/map';
import { AppShell } from '@/components/ui/AppShell';
import { Card, CardTitle } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Field';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusStepper } from '@/components/order/StatusStepper';
import { EtaPanel, RiderLastSeen } from '@/components/order/EtaPanel';
import { useSocket } from '@/hooks/useSocket';
import { useOrderRoom } from '@/hooks/useOrderRoom';
import { useTrackingStore } from '@/store/useTrackingStore';
import { useAuthStore } from '@/store/useAuthStore';
import { formatDistance, formatDuration } from '@/lib/format';
import { activeLegRoute } from '@/services/types';

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

  const backHref = role === 'admin' ? '/admin/dispatch' : '/customer';

  if (error) {
    return (
      <AppShell title="Track order">
        <div className="mx-auto w-full max-w-md p-6">
          <Alert>{error}</Alert>
          <Link href={backHref} className="mt-4 inline-block text-sm font-semibold text-indigo-600">
            ← Back
          </Link>
        </div>
      </AppShell>
    );
  }

  if (!order) {
    return (
      <AppShell title="Track order">
        <FullPageSpinner label="Connecting to live tracking…" />
      </AppShell>
    );
  }

  const live = ['assigned', 'picked_up', 'in_transit'].includes(order.status);
  const riderId = order.rider?.id ?? null;

  return (
    <AppShell title={`Order ${order.code}`}>
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="h-[55dvh] lg:h-auto lg:flex-1">
          <LiveTrackingMap
            route={(activeLegRoute(order) ?? order.route)?.polyline}
            places={places}
            riderIds={riderId && live ? [riderId] : []}
            followRiderId={null}
            fitKey={order.id}
          />
        </div>

        <aside className="w-full space-y-4 border-t border-slate-200 bg-slate-50 p-4 lg:w-[380px] lg:border-l lg:border-t-0 lg:overflow-y-auto">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <StatusBadge status={order.status} />
              <Link href={backHref} className="text-xs font-semibold text-indigo-600">
                ← All orders
              </Link>
            </div>
            {order.status === 'delivered' ? (
              <p className="text-2xl font-bold text-emerald-600">Delivered 🎉</p>
            ) : order.status === 'pending' ? (
              <p className="text-sm text-slate-600">Finding a rider for your order…</p>
            ) : (
              <EtaPanel orderId={order.id} />
            )}
          </Card>

          {order.rider && (
            <Card>
              <CardTitle>Your rider</CardTitle>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-indigo-100 font-bold text-indigo-700">
                  {order.rider.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{order.rider.name}</p>
                  {live && riderId && <RiderLastSeen riderId={riderId} />}
                </div>
                {order.rider.phone && (
                  <a href={`tel:${order.rider.phone}`} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    Call
                  </a>
                )}
              </div>
            </Card>
          )}

          <Card>
            <CardTitle>Progress</CardTitle>
            <StatusStepper order={order} />
          </Card>

          <Card className="space-y-2 text-sm">
            <CardTitle>Details</CardTitle>
            <p><span className="font-medium text-blue-600">Pickup:</span> {order.pickup.address}</p>
            <p><span className="font-medium text-green-600">Drop-off:</span> {order.dropoff.address}</p>
            {order.route && (
              <p className="text-slate-500">
                Route {formatDistance(order.route.distanceMeters)} · ~{formatDuration(order.route.durationSeconds)}
                {order.route.source === 'fallback' && ' (approximate)'}
              </p>
            )}
            {order.notes && <p className="text-slate-500">Note: {order.notes}</p>}
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}
