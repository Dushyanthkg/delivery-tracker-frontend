import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Friendly placeholder for empty lists: icon in a soft halo, title, hint, optional action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  compact,
  className,
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'gap-2 py-6' : 'gap-3 py-10', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'relative grid place-items-center rounded-2xl bg-brand-soft text-brand-text',
          'before:absolute before:-inset-2 before:rounded-3xl before:bg-brand-soft/50',
          compact ? 'size-11 [&_svg]:size-5' : 'size-14 [&_svg]:size-6',
        )}
      >
        <span className="relative">{icon}</span>
      </span>
      <div className="mt-1 space-y-1">
        <p className={cn('font-semibold text-text', compact ? 'text-sm' : 'text-base')}>{title}</p>
        {description && <p className="mx-auto max-w-xs text-sm text-text-muted">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
