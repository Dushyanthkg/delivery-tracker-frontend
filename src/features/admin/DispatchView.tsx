'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { BellRing, Bike, Check, ChevronRight, Hourglass, Inbox, LocateFixed, PackageSearch, Search, Users } from 'lucide-react';
import { LiveTrackingMap, type MapPlace } from '@/components/map';
import { AppShell } from '@/components/ui/AppShell';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card, CardTitle } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { MapScreen } from '@/components/ui/MapScreen';
import { Stat } from '@/components/ui/Stat';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { RiderLastSeen } from '@/components/order/EtaPanel';
import { RouteVisual } from '@/components/order/RouteVisual';
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

  const toggleRider = (id: string) => setFocusRiderId((cur) => (cur === id ? null : id));

  return (
    <AppShell title="Dispatch" layout="map">
      <MapScreen
        label="Dispatch queue"
        map={
          <LiveTrackingMap
            route={selected ? (activeLegRoute(selected) ?? selected.route)?.polyline : null}
            places={places}
            riderIds={mappedRiderIds}
            followRiderId={focusRiderId}
            fitKey={selectedId}
            onRiderClick={toggleRider}
          />
        }
        peek={
          <div className="grid grid-cols-3 gap-2 pb-2" role="group" aria-label="Fleet overview">
            <Stat label="Online riders" value={onlineCount} icon={<Users />} tone="success" />
            <Stat label="Active" value={active.length} icon={<Bike />} tone="brand" />
            <Stat label="Unassigned" value={unassigned.length} icon={<Inbox />} tone={unassigned.length ? 'warning' : 'neutral'} />
          </div>
        }
      >
        {error && <Alert>{error}</Alert>}

        <Card>
          <CardTitle icon={<PackageSearch />} action={<Badge tone={unassigned.length ? 'warning' : 'neutral'}>{unassigned.length}</Badge>}>
            Unassigned orders
          </CardTitle>
          {unassigned.length === 0 && <EmptyState compact icon={<Check />} title="All caught up" description="New orders appear here the moment they’re placed." />}
          <ul className="space-y-2">
            {unassigned.map((o) => {
              const isSelected = o.id === selectedId;
              return (
                <li
                  key={o.id}
                  className={cn(
                    'animate-fade-in rounded-2xl ring-1 transition-[background-color,box-shadow] duration-(--duration-fast)',
                    isSelected ? 'bg-brand-soft/50 shadow-md ring-2 ring-brand' : 'bg-surface ring-border hover:ring-border-strong',
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    className="flex w-full flex-col gap-2 rounded-2xl p-3 text-left"
                    onClick={() => setSelectedId(isSelected ? null : o.id)}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'grid size-5 place-items-center rounded-full ring-1 transition-colors',
                            isSelected ? 'bg-brand text-brand-fg ring-brand' : 'ring-border-strong',
                          )}
                        >
                          {isSelected && <Check className="size-3" strokeWidth={3} />}
                        </span>
                        <span className="font-mono text-sm font-semibold text-text">{o.code}</span>
                      </span>
                      {o.route && <span className="text-xs tabular-nums text-text-muted">~{formatDuration(o.route.durationSeconds)} trip</span>}
                    </span>
                    <RouteVisual compact inline pickup={o.pickup.address} dropoff={o.dropoff.address} />
                    <DispatchProgress orderId={o.id} />
                  </button>
                  {isSelected && (
                    <div className="px-3 pb-3">
                      <NearbyRidersPanel order={o} onAssigned={() => setSelectedId(null)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardTitle icon={<Bike />} action={<Badge tone="brand">{active.length}</Badge>}>
            Active deliveries
          </CardTitle>
          {active.length === 0 && <p className="text-sm text-text-muted">No deliveries in progress.</p>}
          <ul className="-mx-2 space-y-1">
            {active.map((o) => {
              const isSelected = o.id === selectedId;
              return (
                <li key={o.id} className="flex items-center gap-1">
                  {/* Select to show this delivery's road route + pins on the map and follow its rider. */}
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelectedId(isSelected ? null : o.id);
                      setFocusRiderId(isSelected ? null : (o.rider?.id ?? null));
                    }}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-muted',
                      isSelected && 'bg-brand-soft hover:bg-brand-soft',
                    )}
                  >
                    {o.rider ? <Avatar id={o.rider.id} name={o.rider.name} size="sm" /> : <span className="size-8 shrink-0 rounded-full bg-surface-muted" />}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-text">{o.code}</span>
                        <StatusBadge status={o.status} />
                      </span>
                      <span className="block truncate text-xs text-text-muted">
                        {o.rider?.name ?? '—'} · {o.dropoff.address}
                      </span>
                    </span>
                  </button>
                  <Link
                    href={`/customer/track/${o.id}`}
                    transitionTypes={['nav-forward']}
                    aria-label={`Track ${o.code}`}
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-text-subtle transition-colors hover:bg-surface-muted hover:text-brand-text"
                  >
                    <ChevronRight aria-hidden="true" className="size-5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardTitle icon={<Users />} action={<span className="text-xs text-text-muted tabular-nums">{onlineCount} online</span>}>
            Riders
          </CardTitle>
          {riderList.length === 0 && <p className="text-sm text-text-muted">No riders have connected yet.</p>}
          <ul className="-mx-2 space-y-1">
            {riderList.map((key) => {
              const [id, name, online] = key.split('|') as [string, string, string];
              const following = focusRiderId === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    aria-pressed={following}
                    onClick={() => toggleRider(id)}
                    className={cn(
                      'flex min-h-touch w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-surface-muted',
                      following && 'bg-brand-soft hover:bg-brand-soft',
                    )}
                  >
                    <Avatar id={id} name={name} size="sm" online={online === '1'} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text">{name}</span>
                      {online === '1' ? <RiderLastSeen riderId={id} prefix="Seen" /> : <span className="text-xs text-text-subtle">Offline</span>}
                    </span>
                    {following && (
                      <Badge tone="brand" icon={<LocateFixed aria-hidden="true" />}>
                        Following
                      </Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </MapScreen>
    </AppShell>
  );
}

/** Auto-dispatch progress for one pending order (own selector → only this line re-renders). */
function DispatchProgress({ orderId }: { orderId: string }) {
  const status = useTrackingStore((s) => s.dispatch[orderId]);
  const now = useNow();
  if (!status) return null;
  const text = describeDispatch(status, now);
  if (!text) return null;
  const Icon = status.state === 'searching' ? Search : status.state === 'offered' ? BellRing : Hourglass;
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 text-xs font-medium',
        status.state === 'no_riders' ? 'text-warning-text' : 'text-brand-text',
      )}
    >
      <Icon aria-hidden="true" className={cn('size-3.5 shrink-0', status.state === 'searching' && 'animate-pulse')} />
      {text}
    </span>
  );
}

function describeDispatch(s: DispatchStatusBroadcast, now: number | null): string {
  const tried = s.attempts ? ` · ${s.attempts} passed` : '';
  switch (s.state) {
    case 'searching':
      return `Finding the nearest rider…${tried}`;
    case 'offered': {
      const left = s.expiresAt && now ? Math.max(0, Math.round((Date.parse(s.expiresAt) - now) / 1000)) : null;
      return `Offered to ${s.riderName ?? 'rider'}${left != null ? ` · ${left}s` : ''}${tried}`;
    }
    case 'no_riders':
      return `No riders available nearby — retrying${tried}`;
    default:
      return '';
  }
}
