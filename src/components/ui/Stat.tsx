import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { Tone } from './Badge';

const ICON_TONE: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-text-muted',
  brand: 'bg-brand-soft text-brand-text',
  success: 'bg-success-soft text-success-text',
  warning: 'bg-warning-soft text-warning-text',
  danger: 'bg-danger-soft text-danger-text',
  info: 'bg-info-soft text-info-text',
};

/** KPI tile: tinted icon, big tabular number, small label. */
export function Stat({
  label,
  value,
  icon,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 rounded-xl bg-surface-muted/60 p-2.5 ring-1 ring-inset ring-border', className)}>
      <div className="flex items-center gap-2">
        {icon && (
          <span aria-hidden="true" className={cn('grid size-7 shrink-0 place-items-center rounded-lg [&_svg]:size-4', ICON_TONE[tone])}>
            {icon}
          </span>
        )}
        <p className="text-xl font-bold leading-none tracking-tight tabular-nums text-text">{value}</p>
      </div>
      <p className="mt-1.5 text-xs font-medium leading-tight text-text-muted">{label}</p>
    </div>
  );
}
