'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/ui/AppShell';
import { Card, CardTitle } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useSocket, useSocketEvent } from '@/hooks/useSocket';
import { errorMessage, ordersApi } from '@/services/api';
import { formatDistance } from '@/lib/format';
import type { Order } from '@/services/types';
import { CreateOrderForm } from './CreateOrderForm';

export function CustomerHomeView() {
  const socket = useSocket();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ordersApi
      .list({ limit: 20 })
      .then((o) => !cancelled && setOrders(o))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  // Status changes arrive on the customer's personal room.
  useSocketEvent(socket, 'order_status_changed', ({ order }) =>
    setOrders((list) => list?.map((o) => (o.id === order.id ? order : o)) ?? list),
  );

  return (
    <AppShell title="My deliveries">
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4">
        <Card>
          <CardTitle>New delivery</CardTitle>
          <CreateOrderForm />
        </Card>

        <Card>
          <CardTitle>Recent orders</CardTitle>
          {error && <Alert>{error}</Alert>}
          {!orders && !error && (
            <div className="py-6">
              <Spinner />
            </div>
          )}
          {orders?.length === 0 && <p className="text-sm text-slate-500">No orders yet. Place one above.</p>}
          <ul className="divide-y divide-slate-100">
            {orders?.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/customer/track/${o.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      {o.code} <StatusBadge status={o.status} />
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {o.pickup.address} → {o.dropoff.address}
                    </p>
                  </div>
                  {o.route && <span className="text-xs text-slate-500">{formatDistance(o.route.distanceMeters)}</span>}
                  <span className="text-slate-300">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
