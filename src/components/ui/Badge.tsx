import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<Tone, { badge: string; dot: string }> = {
  neutral: { badge: 'bg-surface-muted text-text-muted ring-border', dot: 'bg-text-subtle' },
  brand: { badge: 'bg-brand-soft text-brand-text ring-brand/20', dot: 'bg-brand' },
  success: { badge: 'bg-success-soft text-success-text ring-success/20', dot: 'bg-success' },
  warning: { badge: 'bg-warning-soft text-warning-text ring-warning/30', dot: 'bg-warning' },
  danger: { badge: 'bg-danger-soft text-danger-text ring-danger/20', dot: 'bg-danger' },
  info: { badge: 'bg-info-soft text-info-text ring-info/20', dot: 'bg-info' },
};

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  icon?: ReactNode;
  /** Leading dot; `pulse` animates it (live states). */
  dot?: boolean | 'pulse';
  size?: 'sm' | 'md';
}

export function Badge({ tone = 'neutral', icon, dot, size = 'sm', className, children, ...rest }: Props) {
  const t = TONES[tone];
  return (
    <span
      {...rest}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset [&_svg]:shrink-0',
        size === 'sm' ? 'h-6 px-2 text-xs [&_svg]:size-3.5' : 'h-7 px-2.5 text-sm [&_svg]:size-4',
        t.badge,
        className,
      )}
    >
      {dot && <LiveDot className={t.dot} pulse={dot === 'pulse'} />}
      {icon}
      {children}
    </span>
  );
}

/** Small status dot; `pulse` adds an expanding ring (disabled under reduced motion). */
export function LiveDot({ className, pulse }: { className?: string; pulse?: boolean }) {
  return (
    <span aria-hidden="true" className="relative inline-flex size-2 shrink-0">
      {pulse && <span className={cn('absolute inset-0 animate-live-ping rounded-full', className)} />}
      <span className={cn('relative inline-flex size-2 rounded-full', className)} />
    </span>
  );
}
