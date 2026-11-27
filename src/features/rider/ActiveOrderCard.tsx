'use client';

import { CircleCheckBig, Navigation, PackageCheck, Phone, ReceiptText, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { KeyValue, KeyValueList } from '@/components/ui/KeyValue';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EtaPanel } from '@/components/order/EtaPanel';
import { RouteVisual } from '@/components/order/RouteVisual';
import { formatDistance, formatDuration } from '@/lib/format';
import type { Order, OrderStatus } from '@/services/types';

export interface NextAction {
  status: OrderStatus;
  label: string;
  variant: 'primary' | 'success';
}

const ACTION_ICON: Partial<Record<OrderStatus, LucideIcon>> = {
  picked_up: PackageCheck,
  in_transit: Navigation,
  delivered: CircleCheckBig,
};

/** Always-visible summary (sheet peek): code, status, ETA and the big next-step button. */
export function ActiveOrderSummary({
  order,
  nextAction,
  pending,
  onAdvance,
}: {
  order: Order;
  nextAction?: NextAction;
  pending: boolean;
  onAdvance: () => void;
}) {
  const Icon = nextAction ? ACTION_ICON[nextAction.status] : undefined;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-sm font-semibold text-text">{order.code}</p>
        <StatusBadge status={order.status} size="md" />
      </div>
      <EtaPanel orderId={order.id} size="compact" pickupMeters={order.pickupRoute?.distanceMeters} dropoffMeters={order.route?.distanceMeters} />
      {nextAction && (
        <Button
          className="w-full"
          size="xl"
          variant={nextAction.variant}
          loading={pending}
          onClick={onAdvance}
          leftIcon={Icon ? <Icon aria-hidden="true" /> : undefined}
        >
          {nextAction.label}
        </Button>
      )}
    </div>
  );
}

/** Addresses, customer and route for the active job. */
export function ActiveOrderDetails({ order }: { order: Order }) {
  return (
    <Card>
      <CardTitle icon={<ReceiptText />}>Job details</CardTitle>
      <RouteVisual pickup={order.pickup.address} dropoff={order.dropoff.address} />
      <KeyValueList className="mt-4 border-t border-border pt-3">
        <KeyValue label="Customer">
          <span className="flex items-center justify-end gap-2">
            <span className="truncate">{order.customer.name}</span>
            {order.customer.phone && (
              <IconButton size="sm" variant="soft" href={`tel:${order.customer.phone}`} label={`Call ${order.customer.name} (${order.customer.phone})`} icon={<Phone />} />
            )}
          </span>
        </KeyValue>
        {order.route && (
          <KeyValue label="Route">
            <span className="tabular-nums">
              {formatDistance(order.route.distanceMeters)} · ~{formatDuration(order.route.durationSeconds)}
            </span>
          </KeyValue>
        )}
        {order.notes && (
          <KeyValue label="Note">
            <span className="font-normal">{order.notes}</span>
          </KeyValue>
        )}
      </KeyValueList>
    </Card>
  );
}
