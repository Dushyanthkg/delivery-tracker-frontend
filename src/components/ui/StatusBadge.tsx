import { Bike, CircleX, Clock, Package, PackageCheck, UserCheck, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { STATUS_LABELS } from '@/lib/format';
import type { OrderStatus } from '@/services/types';
import { LiveDot } from './Badge';

/** Per-status icon + token classes. Literal class strings so Tailwind can see them. */
export const STATUS_META: Record<OrderStatus, { icon: LucideIcon; badge: string; tile: string; solid: string; text: string; live: boolean }> = {
  pending: {
    icon: Clock,
    badge: 'bg-status-pending-soft text-status-pending-text ring-status-pending/30',
    tile: 'bg-status-pending-soft text-status-pending-text',
    solid: 'bg-status-pending',
    text: 'text-status-pending-text',
    live: false,
  },
  assigned: {
    icon: UserCheck,
    badge: 'bg-status-assigned-soft text-status-assigned-text ring-status-assigned/25',
    tile: 'bg-status-assigned-soft text-status-assigned-text',
    solid: 'bg-status-assigned',
    text: 'text-status-assigned-text',
    live: true,
  },
  picked_up: {
    icon: Package,
    badge: 'bg-status-picked-up-soft text-status-picked-up-text ring-status-picked-up/25',
    tile: 'bg-status-picked-up-soft text-status-picked-up-text',
    solid: 'bg-status-picked-up',
    text: 'text-status-picked-up-text',
    live: true,
  },
  in_transit: {
    icon: Bike,
    badge: 'bg-status-in-transit-soft text-status-in-transit-text ring-status-in-transit/25',
    tile: 'bg-status-in-transit-soft text-status-in-transit-text',
    solid: 'bg-status-in-transit',
    text: 'text-status-in-transit-text',
    live: true,
  },
  delivered: {
    icon: PackageCheck,
    badge: 'bg-status-delivered-soft text-status-delivered-text ring-status-delivered/25',
    tile: 'bg-status-delivered-soft text-status-delivered-text',
    solid: 'bg-status-delivered',
    text: 'text-status-delivered-text',
    live: false,
  },
  cancelled: {
    icon: CircleX,
    badge: 'bg-status-cancelled-soft text-status-cancelled-text ring-status-cancelled/25',
    tile: 'bg-status-cancelled-soft text-status-cancelled-text',
    solid: 'bg-status-cancelled',
    text: 'text-status-cancelled-text',
    live: false,
  },
};

/** Status pill: icon + label (never colour alone), with a live dot while a rider is en route. */
export function StatusBadge({ status, size = 'sm', className }: { status: OrderStatus; size?: 'sm' | 'md'; className?: string }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset',
        size === 'sm' ? 'h-6 pl-1.5 pr-2 text-xs' : 'h-7 pl-2 pr-2.5 text-sm',
        meta.badge,
        className,
      )}
    >
      {meta.live && <LiveDot pulse className={meta.solid} />}
      <Icon aria-hidden="true" className={size === 'sm' ? 'size-3.5' : 'size-4'} strokeWidth={2.25} />
      {STATUS_LABELS[status]}
    </span>
  );
}
