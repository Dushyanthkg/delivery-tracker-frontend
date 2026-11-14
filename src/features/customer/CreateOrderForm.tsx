'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LiveTrackingMap, type MapPlace } from '@/components/map';
import { Button } from '@/components/ui/Button';
import { Alert, Field, Input } from '@/components/ui/Field';
import { errorMessage, ordersApi } from '@/services/api';
import type { LatLng } from '@/services/types';
import { cn } from '@/lib/cn';

type Target = 'pickup' | 'dropoff';

const fmt = (p: LatLng) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;

/** Click the map to drop pickup and dropoff pins, then submit. */
export function CreateOrderForm() {
  const router = useRouter();
  const [target, setTarget] = useState<Target>('pickup');
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [dropoff, setDropoff] = useState<LatLng | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const places = useMemo<MapPlace[]>(() => {
    const out: MapPlace[] = [];
    if (pickup) out.push({ id: 'pickup', kind: 'pickup', position: pickup, label: 'Pickup' });
    if (dropoff) out.push({ id: 'dropoff', kind: 'dropoff', position: dropoff, label: 'Drop-off' });
    return out;
  }, [pickup, dropoff]);

  function onMapClick(p: LatLng) {
    if (target === 'pickup') {
      setPickup(p);
      if (!pickupAddress) setPickupAddress(`Pinned location (${fmt(p)})`);
      setTarget('dropoff');
    } else {
      setDropoff(p);
      if (!dropoffAddress) setDropoffAddress(`Pinned location (${fmt(p)})`);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pickup || !dropoff) return setError('Click the map to set both pickup and drop-off.');
    setError(null);
    setSubmitting(true);
    try {
      const order = await ordersApi.create({
        pickup: { ...pickup, address: pickupAddress },
        dropoff: { ...dropoff, address: dropoffAddress },
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      router.push(`/customer/track/${order.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="relative h-80 overflow-hidden rounded-xl ring-1 ring-slate-200 lg:h-[440px]">
        <LiveTrackingMap places={places} onMapClick={onMapClick} />
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[1000] flex justify-center">
          <span className="rounded-full bg-slate-900/80 px-3 py-1 text-xs font-medium text-white">
            Click the map to set the {target === 'pickup' ? 'pickup' : 'drop-off'} point
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div className="grid grid-cols-2 gap-2">
          {(['pickup', 'dropoff'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTarget(t)}
              className={cn(
                'rounded-lg px-3 py-2 text-left text-xs ring-1 transition',
                target === t ? 'bg-indigo-50 ring-indigo-500' : 'bg-white ring-slate-200 hover:bg-slate-50',
              )}
            >
              <span className="block font-semibold text-slate-800">{t === 'pickup' ? 'Pickup' : 'Drop-off'}</span>
              <span className="text-slate-500">{(t === 'pickup' ? pickup : dropoff) ? 'Set ✓' : 'Not set'}</span>
            </button>
          ))}
        </div>
        <Field label="Pickup address">
          <Input required minLength={3} value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} />
        </Field>
        <Field label="Drop-off address">
          <Input required minLength={3} value={dropoffAddress} onChange={(e) => setDropoffAddress(e.target.value)} />
        </Field>
        <Field label="Notes (optional)">
          <Input value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder="Gate code, fragile…" />
        </Field>
        <Button type="submit" className="w-full" loading={submitting} disabled={!pickup || !dropoff}>
          Place order
        </Button>
      </div>
    </form>
  );
}
