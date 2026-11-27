import { cn } from '@/lib/cn';
import { riderColor } from '@/components/map/theme';

const SIZES = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-12 text-base' };

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : '';
  return (first + last).toUpperCase();
}

/**
 * Initials avatar. Colour is derived from `id` with the same palette as the
 * rider's map marker, so a rider looks the same in lists and on the map.
 */
export function Avatar({
  id,
  name,
  size = 'md',
  online,
  className,
}: {
  id: string;
  name: string;
  size?: keyof typeof SIZES;
  /** Presence dot (bottom-right); omit for none. */
  online?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        aria-hidden="true"
        className={cn('grid place-items-center rounded-full font-semibold tracking-wide text-white ring-2 ring-surface', SIZES[size])}
        style={{ background: riderColor(id) }}
      >
        {initials(name)}
      </span>
      {online !== undefined && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-surface',
            online ? 'bg-success' : 'bg-status-cancelled',
          )}
        />
      )}
    </span>
  );
}
