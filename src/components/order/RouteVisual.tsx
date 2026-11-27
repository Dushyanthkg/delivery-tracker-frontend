import type { ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Pickup → drop-off as a connected route: hollow pickup dot, dashed line,
 * drop-off pin. Labels are text (not colour alone).
 */
export function RouteVisual({
  pickup,
  dropoff,
  compact,
  inline,
  className,
}: {
  pickup: string;
  dropoff: string;
  /** Render spans instead of a list — for use inside buttons (phrasing content only). */
  inline?: boolean;
  /** Single-line truncated addresses (list rows). */
  compact?: boolean;
  className?: string;
}) {
  const List = inline ? 'span' : 'ol';
  return (
    <List className={cn('relative grid gap-y-2.5', compact && 'gap-y-1.5', className)}>
      {/* Connector between the two markers */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-[7px] w-0 border-l-2 border-dashed border-border-strong',
          compact ? 'bottom-[11px] top-[11px]' : 'bottom-[14px] top-[14px]',
        )}
      />
      <Stop inline={inline} label="Pickup" address={pickup} compact={compact} marker={<span className="size-3 rounded-full border-[3px] border-pickup bg-surface" />} />
      <Stop inline={inline} label="Drop-off" address={dropoff} compact={compact} marker={<MapPin className="size-4 fill-dropoff text-dropoff [&_circle]:fill-surface [&_circle]:stroke-surface" strokeWidth={2.25} />} />
    </List>
  );
}

function Stop({ label, address, marker, compact, inline }: { label: string; address: string; marker: ReactNode; compact?: boolean; inline?: boolean }) {
  const Item = inline ? 'span' : 'li';
  return (
    <Item className="relative flex min-w-0 items-start gap-3">
      <span aria-hidden="true" className={cn('relative z-10 grid w-4 shrink-0 place-items-center', compact ? 'h-5' : 'h-6')}>
        {marker}
      </span>
      <span className={cn('min-w-0 flex-1', compact ? 'flex items-baseline gap-2' : 'block')}>
        <span className={cn('text-xs font-medium text-text-muted', compact ? 'sr-only' : 'block leading-6')}>{label}</span>
        <span className={cn('text-sm text-text', compact ? 'block truncate leading-5' : 'block')}>{address}</span>
      </span>
    </Item>
  );
}
