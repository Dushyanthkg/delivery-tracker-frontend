import { cn } from '@/lib/cn';

/**
 * Brand mark: a route that leaves a pickup dot and curves up into a drop-off
 * pin, on a brand-coloured rounded square.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-8 shrink-0', className)}>
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <path
        d="M8.5 23.5c0-4 3-5 6.5-5s6.5-1 6.5-5"
        fill="none"
        stroke="white"
        strokeOpacity=".55"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="0.1 4"
      />
      <circle cx="8.5" cy="23.5" r="2.6" fill="white" />
      <path d="M21.5 4.5a4.8 4.8 0 0 1 4.8 4.8c0 3.4-4.8 7.9-4.8 7.9s-4.8-4.5-4.8-7.9a4.8 4.8 0 0 1 4.8-4.8Z" fill="white" />
      <circle cx="21.5" cy="9.4" r="1.8" fill="var(--brand)" />
    </svg>
  );
}

export function Logo({ className, wordmark = true }: { className?: string; wordmark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {wordmark && (
        <span className="text-[15px] font-semibold tracking-tight text-text">
          Delivery<span className="text-brand-text">Track</span>
        </span>
      )}
    </span>
  );
}
