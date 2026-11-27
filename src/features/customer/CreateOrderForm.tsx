'use client';

import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Crosshair, MapPin, MousePointerClick, StickyNote } from 'lucide-react';
import { LiveTrackingMap, type MapPlace } from '@/components/map';
import { Button } from '@/components/ui/Button';
import { Alert, Field, Input } from '@/components/ui/Field';
import { AddressAutocomplete } from './AddressAutocomplete';
import { toast } from '@/components/ui/Toast';
import { errorMessage, ordersApi } from '@/services/api';
import type { LatLng, PlaceSuggestion } from '@/services/types';
import { config } from '@/lib/config';
import { cn } from '@/lib/cn';

type Target = 'pickup' | 'dropoff';

const fmt = (p: LatLng) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
const MIN_ADDRESS = 3;

/** Search an address or click the map to drop pickup and dropoff pins, then submit. */
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
  const [touched, setTouched] = useState<Record<Target, boolean>>({ pickup: false, dropoff: false });
  const pickupInput = useRef<HTMLInputElement>(null);
  const dropoffInput = useRef<HTMLInputElement>(null);
  // Bumped when a suggestion is chosen so the map moves to the new pin(s).
  const [fitKey, setFitKey] = useState(0);

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

  function onPlaceSelect(t: Target, place: PlaceSuggestion) {
    const p = { lat: place.lat, lng: place.lng };
    if (t === 'pickup') {
      setPickup(p);
      setPickupAddress(place.address);
      if (!dropoff) setTarget('dropoff');
    } else {
      setDropoff(p);
      setDropoffAddress(place.address);
    }
    setFitKey((k) => k + 1);
  }

  const addressError = (t: Target) => {
    const value = (t === 'pickup' ? pickupAddress : dropoffAddress).trim();
    if (!touched[t]) return undefined;
    if (!value) return `Enter a ${t === 'pickup' ? 'pickup' : 'drop-off'} address`;
    if (value.length < MIN_ADDRESS) return `Use at least ${MIN_ADDRESS} characters`;
    return undefined;
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pickup || !dropoff) return setError('Choose a suggestion or click the map to set both pickup and drop-off.');
    // Inline validation replaces the browser's bubbles (form is noValidate).
    setTouched({ pickup: true, dropoff: true });
    if (pickupAddress.trim().length < MIN_ADDRESS) return pickupInput.current?.focus();
    if (dropoffAddress.trim().length < MIN_ADDRESS) return dropoffInput.current?.focus();
    setError(null);
    setSubmitting(true);
    try {
      const order = await ordersApi.create({
        pickup: { ...pickup, address: pickupAddress },
        dropoff: { ...dropoff, address: dropoffAddress },
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      toast.success('Order placed', { description: `${order.code} — finding a rider now.` });
      router.push(`/customer/track/${order.id}`, { transitionTypes: ['nav-forward'] });
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  const missing = !pickup ? 'pickup' : !dropoff ? 'drop-off' : null;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="relative h-64 overflow-hidden rounded-2xl ring-1 ring-border sm:h-80 lg:h-[360px]">
        <LiveTrackingMap places={places} onMapClick={onMapClick} fitKey={fitKey || null} />
        <div className="pointer-events-none absolute inset-x-0 top-3 z-(--z-map-overlay) flex justify-center px-3">
          <span
            aria-live="polite"
            className="inline-flex items-center gap-2 rounded-full bg-glass px-3.5 py-2 text-xs font-semibold text-text shadow-md ring-1 ring-border backdrop-blur-md"
          >
            <MousePointerClick aria-hidden="true" className={cn('size-4', target === 'pickup' ? 'text-pickup' : 'text-dropoff')} />
            Search above or click the map to set the {target === 'pickup' ? 'pickup' : 'drop-off'} point
          </span>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="space-y-4">
        <LocationRow
          kind="pickup"
          active={target === 'pickup'}
          pinned={!!pickup}
          onPick={() => setTarget('pickup')}
          connector
          marker={<span className="size-3.5 rounded-full border-[3.5px] border-pickup bg-surface" />}
        >
          <Field label="Pickup address" error={addressError('pickup')}>
            <AddressAutocomplete
              inputRef={pickupInput}
              label="Pickup address"
              value={pickupAddress}
              placeholder="Search a place or click the map"
              near={pickup ?? dropoff ?? config.defaultCenter}
              onChange={setPickupAddress}
              onSelect={(place) => onPlaceSelect('pickup', place)}
              onBlur={() => setTouched((t) => ({ ...t, pickup: true }))}
            />
          </Field>
        </LocationRow>
        <LocationRow
          kind="dropoff"
          active={target === 'dropoff'}
          pinned={!!dropoff}
          onPick={() => setTarget('dropoff')}
          marker={<MapPin className="size-5 fill-dropoff text-dropoff [&_circle]:fill-surface [&_circle]:stroke-surface" />}
        >
          <Field label="Drop-off address" error={addressError('dropoff')}>
            <AddressAutocomplete
              inputRef={dropoffInput}
              label="Drop-off address"
              value={dropoffAddress}
              placeholder="Search a place or click the map"
              near={dropoff ?? pickup ?? config.defaultCenter}
              onChange={setDropoffAddress}
              onSelect={(place) => onPlaceSelect('dropoff', place)}
              onBlur={() => setTouched((t) => ({ ...t, dropoff: true }))}
            />
          </Field>
        </LocationRow>
      </div>

      <Field label="Notes (optional)">
        <Input
          value={notes}
          maxLength={500}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Gate code, fragile…"
          leading={<StickyNote className="text-text-subtle" />}
        />
      </Field>

      {/* Sticky on phones so the action stays in reach while scrolling the form. */}
      <div className="sticky bottom-0 z-10 -mx-4 -mb-4 border-t border-border bg-glass px-4 pb-[calc(var(--safe-bottom)+1rem)] pt-3 backdrop-blur-xl sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button type="submit" size="lg" className="w-full" loading={submitting} disabled={!pickup || !dropoff}>
          Place order
        </Button>
        {missing && (
          <p className="mt-2 text-center text-xs text-text-muted">Pick a {missing} suggestion or set it on the map to continue.</p>
        )}
      </div>
    </form>
  );
}

function LocationRow({
  kind,
  active,
  pinned,
  onPick,
  marker,
  connector,
  children,
}: {
  kind: Target;
  /** Dashed line down to the next row's marker. */
  connector?: boolean;
  active: boolean;
  pinned: boolean;
  onPick: () => void;
  marker: ReactNode;
  children: ReactNode;
}) {
  const name = kind === 'pickup' ? 'pickup' : 'drop-off';
  return (
    <div className="flex gap-3">
      <div aria-hidden="true" className="flex shrink-0 flex-col items-center">
        <span className="mt-7 grid size-10 place-items-center rounded-xl bg-surface-muted ring-1 ring-border">{marker}</span>
        {/* Runs through the row gap (16px) and the next marker's top margin (28px). */}
        {connector && <span className="mb-[-2.5rem] mt-1 w-0 flex-1 border-l-2 border-dashed border-border-strong" />}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {children}
        <div className="flex items-center justify-between gap-2">
          <span className={cn('inline-flex items-center gap-1 text-xs', pinned ? 'font-medium text-success-text' : 'text-text-muted')}>
            {pinned ? <Check aria-hidden="true" className="size-3.5" /> : null}
            {pinned ? 'Pinned on map' : 'No pin yet'}
          </span>
          <button
            type="button"
            aria-pressed={active}
            onClick={onPick}
            className={cn(
              'relative inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 ring-inset transition-colors after:absolute after:-inset-y-1.5 after:inset-x-0',
              active ? 'bg-brand-soft text-brand-text ring-brand/40' : 'text-text-muted ring-border hover:bg-surface-muted hover:text-text',
            )}
          >
            <Crosshair aria-hidden="true" className="size-3.5" />
            {active ? `Placing ${name}` : `${pinned ? 'Move' : 'Set'} ${name} pin`}
          </button>
        </div>
      </div>
    </div>
  );
}
