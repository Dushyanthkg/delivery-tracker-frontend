'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { LiveTrackingMap, type MapPlace } from '@/components/map';
import { AppShell } from '@/components/ui/AppShell';
import { Card, CardTitle } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Field';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { RiderLastSeen } from '@/components/order/EtaPanel';
import { useSocket, useOnConnect, useSocketEvent } from '@/hooks/useSocket';
import { emitWithAck } from '@/services/socket';
import { useTrackingStore } from '@/store/useTrackingStore';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/cn';
import { activeLegRoute, type DispatchStatusBroadcast, type Order } from '@/services/types';
import { useNow } from '@/hooks/useNow';
import { NearbyRidersPanel } from './NearbyRidersPanel';

const byCreated = (a: Order, b: Order) => a.createdAt.localeCompare(b.createdAt);

export function DispatchView() {
  const socket = useSocket();
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusRiderId, setFocusRiderId] = useState<string | null>(null);

  /* ---------- Live fleet feed ---------- */

  // (Re)join on every connect → fresh snapshot after any outage.
  useOnConnect(socket, () => {
    if (!socket) return;
    void emitWithAck(socket, 'join_fleet_room').then((res) => {
      if (res.ok) {
        useTrackingStore.getState().hydrateFleet(res.data);
        setError(null);
      } else setError(res.error.message);
    });
  });

  useSocketEvent(socket, 'fleet_rider_location', (m) =>
    useTrackingStore.getState().upsertRiderPosition(m.riderId, m.position, { name: m.riderName, activeOrderId: m.activeOrderId }),
  );
  useSocketEvent(socket, 'fleet_rider_presence', (m) =>
    useTrackingStore.getState().setRiderPresence(m.riderId, m.riderName, m.isOnline),
  );
  useSocketEvent(socket, 'order_created', ({ order }) => useTrackingStore.getState().upsertOrder(order));
  useSocketEvent(socket, 'order_status_changed', ({ order }) => useTrackingStore.getState().upsertOrder(order));
  useSocketEvent(socket, 'order_route_updated', (m) => useTrackingStore.getState().applyRouteUpdate(m));
  useSocketEvent(socket, 'dispatch_status', (m) => useTrackingStore.getState().setDispatchStatus(m));

  /* ---------- Narrow selectors (no re-render on GPS ticks) ---------- */

  const orders = useTrackingStore(useShallow((s) => Object.values(s.orders)));
  // Only the *set* of visible riders — positions are consumed by the markers directly.
  const mappedRiderIds = useTrackingStore(
    useShallow((s) => Object.values(s.riders).filter((r) => r.isOnline && r.position).map((r) => r.riderId)),
  );
  const riderList = useTrackingStore(
    useShallow((s) =>
      Object.values(s.riders)
        .map((r) => `${r.riderId}|${r.name}|${r.isOnline ? 1 : 0}`)
        .sort(),
    ),
  );

  const unassigned = useMemo(() => orders.filter((o) => o.status === 'pending').sort(byCreated), [orders]);
  const active = useMemo(
    () => orders.filter((o) => ['assigned', 'picked_up', 'in_transit'].includes(o.status)).sort(byCreated),
    [orders],
  );
  const selected = selectedId ? orders.find((o) => o.id === selectedId) ?? null : null;

  const places = useMemo<MapPlace[]>(() => {
    const pins: MapPlace[] = unassigned.map((o) => ({
      id: `order-${o.id}`,
      kind: 'order',
      position: o.pickup,
      label: `${o.code} · ${o.pickup.address}`,
      selected: o.id === selectedId,
      onClick: () => setSelectedId(o.id),
    }));
    if (selected) {
      pins.push({ id: 'sel-pickup', kind: 'pickup', position: selected.pickup, label: `Pickup · ${selected.pickup.address}` });
      pins.push({ id: 'sel-dropoff', kind: 'dropoff', position: selected.dropoff, label: `Drop-off · ${selected.dropoff.address}` });
    }
    return pins;
  }, [unassigned, selected, selectedId]);

  const onlineCount = riderList.filter((r) => r.endsWith('|1')).length;

  return (
    <AppShell title="Dispatch">
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="relative h-[55dvh] lg:h-auto lg:flex-1">
          <LiveTrackingMap
            route={selected ? (activeLegRoute(selected) ?? selected.route)?.polyline : null}
            places={places}
            riderIds={mappedRiderIds}
            followRiderId={focusRiderId}
            fitKey={selectedId}
            onRiderClick={(id) => setFocusRiderId((cur) => (cur === id ? null : id))}
          />
          <div className="pointer-events-none absolute left-3 top-3 z-[1000] flex gap-2">
            {[
              { label: 'Online riders', value: onlineCount, tone: 'text-emerald-600' },
              { label: 'Active', value: active.length, tone: 'text-indigo-600' },
              { label: 'Unassigned', value: unassigned.length, tone: 'text-amber-600' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-white/95 px-3 py-1.5 shadow-md">
                <p className={cn('text-lg font-bold leading-none tabular-nums', s.tone)}>{s.value}</p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="w-full space-y-4 border-t border-slate-200 bg-slate-50 p-4 lg:w-[400px] lg:overflow-y-auto lg:border-l lg:border-t-0">
          {error && <Alert>{error}</Alert>}

          <Card>
            <CardTitle>Unassigned orders ({unassigned.length})</CardTitle>
            {unassigned.length === 0 && <p className="text-sm text-slate-500">All caught up 🎉</p>}
            <ul className="space-y-2">
              {unassigned.map((o) => (
                <li key={o.id} className={cn('rounded-lg p-3 ring-1 transition', o.id === selectedId ? 'bg-amber-50 ring-amber-300' : 'bg-white ring-slate-200')}>
                  <button type="button" className="w-full text-left" onClick={() => setSelectedId(o.id === selectedId ? null : o.id)}>
                    <p className="flex items-center justify-between text-sm font-semibold text-slate-900">
                      {o.code}
                      {o.route && <span className="text-xs font-normal text-slate-500">~{formatDuration(o.route.durationSeconds)} trip</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">{o.pickup.address} → {o.dropoff.address}</p>
                    <DispatchProgress orderId={o.id} />
                  </button>
                  {o.id === selectedId && <NearbyRidersPanel order={o} onAssigned={() => setSelectedId(null)} />}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardTitle>Active deliveries ({active.length})</CardTitle>
            {active.length === 0 && <p className="text-sm text-slate-500">No deliveries in progress.</p>}
            <ul className="divide-y divide-slate-100">
              {active.map((o) => {
                const isSelected = o.id === selectedId;
                return (
                  <li key={o.id} className="flex items-center gap-2 py-1">
                    {/* Select to show this delivery's road route + pins on the map and follow its rider. */}
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedId(isSelected ? null : o.id);
                        setFocusRiderId(isSelected ? null : (o.rider?.id ?? null));
                      }}
                      className={cn(
                        '-mx-2 min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50',
                        isSelected && 'bg-indigo-50 hover:bg-indigo-50',
                      )}
                    >
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        {o.code} <StatusBadge status={o.status} />
                      </p>
                      <p className="truncate text-xs text-slate-500">{o.rider?.name ?? '—'} · {o.dropoff.address}</p>
                    </button>
                    <Link href={`/customer/track/${o.id}`} className="text-xs font-semibold text-indigo-600">Track ›</Link>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardTitle>Riders</CardTitle>
            <ul className="divide-y divide-slate-100">
              {riderList.map((key) => {
                const [id, name, online] = key.split('|') as [string, string, string];
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setFocusRiderId((cur) => (cur === id ? null : id))}
                      className={cn('-mx-2 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50', focusRiderId === id && 'bg-indigo-50')}
                    >
                      <span className={cn('h-2.5 w-2.5 rounded-full', online === '1' ? 'bg-emerald-500' : 'bg-slate-300')} />
                      <span className="flex-1">
                        <span className="block text-sm font-medium text-slate-900">{name}</span>
                        {online === '1' ? <RiderLastSeen riderId={id} /> : <span className="text-xs text-slate-400">Offline</span>}
                      </span>
                      {focusRiderId === id && <span className="text-xs font-semibold text-indigo-600">Following</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}

/** Auto-dispatch progress for one pending order (own selector → only this line re-renders). */
function DispatchProgress({ orderId }: { orderId: string }) {
  const status = useTrackingStore((s) => s.dispatch[orderId]);
  const now = useNow();
  if (!status) return null;
  const text = describeDispatch(status, now);
  return (
    <p className={cn('mt-1 text-xs font-medium', status.state === 'no_riders' ? 'text-amber-600' : 'text-indigo-600')}>
      {text}
    </p>
  );
}

function describeDispatch(s: DispatchStatusBroadcast, now: number | null): string {
  const tried = s.attempts ? ` · ${s.attempts} passed` : '';
  switch (s.state) {
    case 'searching':
      return `🔎 Finding the nearest rider…${tried}`;
    case 'offered': {
      const left = s.expiresAt && now ? Math.max(0, Math.round((Date.parse(s.expiresAt) - now) / 1000)) : null;
      return `📲 Offered to ${s.riderName ?? 'rider'}${left != null ? ` · ${left}s` : ''}${tried}`;
    }
    case 'no_riders':
      return `⏳ No riders available nearby — retrying${tried}`;
    default:
      return '';
  }
}
