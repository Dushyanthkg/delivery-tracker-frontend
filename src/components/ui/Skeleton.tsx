import { cn } from '@/lib/cn';

/** Shimmering placeholder block. Size it with classes (h-4 w-32, rounded-full, …). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block animate-shimmer rounded-md bg-[length:200%_100%]',
        'bg-[linear-gradient(90deg,var(--surface-muted)_25%,color-mix(in_oklch,var(--surface-muted),var(--text)_6%)_50%,var(--surface-muted)_75%)]',
        className,
      )}
    />
  );
}

/** Screen-reader announcement + visual skeleton rows for a loading list. */
export function SkeletonList({ rows = 3, label = 'Loading…', className }: { rows?: number; label?: string; className?: string }) {
  return (
    <div role="status" className={cn('space-y-3', className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl p-3 ring-1 ring-border">
          <Skeleton className="size-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
