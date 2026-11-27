'use client';

import { useEffect, useState } from 'react';
import { UserPlus, UserX } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { errorMessage, ordersApi } from '@/services/api';
import { formatDistance } from '@/lib/format';
import { useTrackingStore } from '@/store/useTrackingStore';
import type { NearbyRider, Order } from '@/services/types';

/** Closest idle online riders to the order's pickup (server-side $geoNear). */
export function NearbyRidersPanel({ order, onAssigned }: { order: Order; onAssigned: () => void }) {
  const [riders, setRiders] = useState<NearbyRider[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ordersApi
      .nearbyRiders(order.id, 20_000)
      .then((r) => !cancelled && setRiders(r))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [order.id]);

  async function assign(riderId: string) {
    setAssigning(riderId);
    setError(null);
    try {
      const updated = await ordersApi.assign(order.id, riderId);
      useTrackingStore.getState().upsertOrder(updated);
      toast.success(`${updated.code} assigned`, { description: updated.rider ? `${updated.rider.name} is heading to pickup.` : undefined });
      onAssigned();
    } catch (err) {
      setError(errorMessage(err));
      setAssigning(null);
    }
  }

  return (
    <div className="animate-slide-up space-y-2 rounded-xl bg-surface p-3 ring-1 ring-border">
      <p className="text-xs font-semibold text-text-muted">Nearest available riders</p>
      {error && <Alert>{error}</Alert>}
      {!riders && !error && (
        <div role="status" className="space-y-2">
          <span className="sr-only">Finding nearby riders…</span>
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-16" />
              </div>
              <Skeleton className="h-9 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      )}
      {riders?.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <UserX aria-hidden="true" className="size-4 shrink-0" />
          No idle online riders within 20 km.
        </p>
      )}
      <ul className="space-y-1.5">
        {riders?.map((r) => (
          <li key={r.rider.id} className="flex items-center gap-3">
            <Avatar id={r.rider.id} name={r.rider.name} size="sm" online />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text">{r.rider.name}</p>
              <p className="text-xs tabular-nums text-text-muted">{formatDistance(r.distanceMeters)} from pickup</p>
            </div>
            <Button
              size="sm"
              loading={assigning === r.rider.id}
              disabled={!!assigning}
              onClick={() => assign(r.rider.id)}
              leftIcon={<UserPlus aria-hidden="true" />}
              aria-label={`Assign ${r.rider.name}`}
            >
              Assign
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
