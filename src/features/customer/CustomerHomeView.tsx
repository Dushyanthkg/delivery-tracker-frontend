'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, PackageOpen, PackagePlus, Route } from 'lucide-react';
import { AppShell } from '@/components/ui/AppShell';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SkeletonList } from '@/components/ui/Skeleton';
import { StatusBadge, STATUS_META } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/Toast';
import { RouteVisual } from '@/components/order/RouteVisual';
import { useSocket, useSocketEvent } from '@/hooks/useSocket';
import { useNow } from '@/hooks/useNow';
import { errorMessage, ordersApi } from '@/services/api';
import { formatDistance, formatRelativeDate, STATUS_LABELS } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Order, OrderStatus } from '@/services/types';
import { CreateOrderForm } from './CreateOrderForm';

type Filter = 'all' | 'active' | 'delivered';
const ACTIVE: OrderStatus[] = ['pending', 'assigned', 'picked_up', 'in_transit'];
const matches = (f: Filter, o: Order) => f === 'all' || (f === 'active' ? ACTIVE.includes(o.status) : o.status === 'delivered');

export function CustomerHomeView() {
  const socket = useSocket();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

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
  useSocketEvent(socket, 'order_status_changed', ({ order }) => {
    const prev = orders?.find((o) => o.id === order.id);
    if (prev && prev.status !== order.status) {
      toast.info(`${order.code}: ${STATUS_LABELS[order.status]}`, { id: `status-${order.id}` });
    }
    setOrders((list) => list?.map((o) => (o.id === order.id ? order : o)) ?? list);
  });

  const counts = useMemo(
    () => ({
      all: orders?.length ?? 0,
      active: orders?.filter((o) => matches('active', o)).length ?? 0,
      delivered: orders?.filter((o) => matches('delivered', o)).length ?? 0,
    }),
    [orders],
  );
  const visible = useMemo(() => orders?.filter((o) => matches(filter, o)) ?? [], [orders, filter]);

  return (
    <AppShell title="My deliveries">
      <div className="mx-auto grid w-full max-w-screen-2xl grid-cols-[minmax(0,1fr)] gap-4 p-4 sm:gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:p-6 2xl:px-8">
        <section aria-labelledby="new-delivery-title">
          <Card className="p-4 sm:p-6">
            <header className="mb-5 flex items-start gap-3">
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-text">
                <PackagePlus className="size-5" />
              </span>
              <div>
                <h2 id="new-delivery-title" className="text-lg font-semibold tracking-tight text-text">
                  New delivery
                </h2>
                <p className="text-sm text-text-muted">Drop a pickup and a drop-off pin, then confirm the addresses.</p>
              </div>
            </header>
            <CreateOrderForm />
          </Card>
        </section>

        <section aria-labelledby="orders-title" className="lg:sticky lg:top-20 lg:self-start">
          <Card className="p-4 sm:p-6">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="orders-title" className="text-lg font-semibold tracking-tight text-text">
                Your orders
              </h2>
              <SegmentedControl
                aria-label="Filter orders"
                size="sm"
                value={filter}
                onChange={setFilter}
                options={(['all', 'active', 'delivered'] as const).map((f) => ({
                  value: f,
                  label: (
                    <>
                      {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Delivered'}
                      {orders && <span className="text-text-subtle tabular-nums">{counts[f]}</span>}
                    </>
                  ),
                }))}
              />
            </header>

            {error && <Alert>{error}</Alert>}
            {!orders && !error && <SkeletonList rows={4} label="Loading your orders…" />}

            {orders && visible.length === 0 && (
              <EmptyState
                icon={orders.length === 0 ? <PackageOpen /> : <Route />}
                title={orders.length === 0 ? 'No orders yet' : filter === 'active' ? 'Nothing on the way' : 'No deliveries completed yet'}
                description={
                  orders.length === 0
                    ? 'Place your first delivery with the form — you’ll be able to follow the rider live.'
                    : 'Orders matching this filter will show up here.'
                }
              />
            )}

            {visible.length > 0 && <OrderList orders={visible} />}
          </Card>
        </section>
      </div>
    </AppShell>
  );
}

/** Own component so its once-a-minute clock only re-renders the list. */
function OrderList({ orders }: { orders: Order[] }) {
  const now = useNow(60_000);
  return (
    <ul className="space-y-2.5">
      {orders.map((o) => {
        const meta = STATUS_META[o.status];
        const Icon = meta.icon;
        return (
          <li key={o.id} className="animate-fade-in">
            <Link
              href={`/customer/track/${o.id}`}
              transitionTypes={['nav-forward']}
              className="group flex gap-3 rounded-2xl p-3 ring-1 ring-border transition-[background-color,box-shadow,transform] duration-(--duration-fast) ease-out hover:bg-surface-muted/60 hover:shadow-md active:scale-[0.99]"
            >
              <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center rounded-xl', meta.tile)}>
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate">
                    <span className="font-mono text-sm font-semibold text-text">{o.code}</span>
                    {now != null && (
                      <span className="text-xs text-text-subtle">
                        {' · '}
                        <time dateTime={o.createdAt}>{formatRelativeDate(o.createdAt, now)}</time>
                      </span>
                    )}
                  </p>
                  <StatusBadge status={o.status} />
                </div>
                <RouteVisual compact pickup={o.pickup.address} dropoff={o.dropoff.address} />
                {o.route && <p className="text-xs tabular-nums text-text-muted">{formatDistance(o.route.distanceMeters)} trip</p>}
              </div>
              <ChevronRight
                aria-hidden="true"
                className="size-5 shrink-0 self-center text-text-subtle transition-transform duration-(--duration-fast) group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
