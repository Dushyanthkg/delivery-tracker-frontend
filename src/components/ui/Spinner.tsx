import { cn } from '@/lib/cn';

const SIZES = { sm: 'size-4 border-2', md: 'size-6 border-[2.5px]', lg: 'size-8 border-[3px]' };

/** Inline activity indicator (buttons, route guards). Content areas use <Skeleton> instead. */
export function Spinner({ size = 'md', className }: { size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-keep-motion
      className={cn('inline-block shrink-0 animate-spin rounded-full border-current border-r-transparent', SIZES[size], className)}
    />
  );
}

export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-3 text-text-muted">
      <Spinner size="lg" className="text-brand" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
