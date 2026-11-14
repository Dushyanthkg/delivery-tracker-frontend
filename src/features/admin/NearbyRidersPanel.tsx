'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
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
      onAssigned();
    } catch (err) {
      setError(errorMessage(err));
      setAssigning(null);
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nearest available riders</p>
      {error && <Alert>{error}</Alert>}
      {!riders && !error && <Spinner />}
      {riders?.length === 0 && <p className="text-sm text-slate-500">No idle online riders within 20 km.</p>}
      {riders?.map((r) => (
        <div key={r.rider.id} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{r.rider.name}</p>
            <p className="text-xs text-slate-500">{formatDistance(r.distanceMeters)} from pickup</p>
          </div>
          <Button size="sm" loading={assigning === r.rider.id} disabled={!!assigning} onClick={() => assign(r.rider.id)}>
            Assign
          </Button>
        </div>
      ))}
    </div>
  );
}
