'use client';

import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Accessible toggle (role="switch"). Pass `label` for a visible label that is
 * also the accessible name, or `aria-label` when the label lives elsewhere.
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  tone = 'success',
  'aria-label': ariaLabel,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  tone?: 'success' | 'brand';
  'aria-label'?: string;
  className?: string;
}) {
  const id = useId();
  const button = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : ariaLabel}
      aria-labelledby={label ? `${id}-label` : undefined}
      aria-describedby={description ? `${id}-desc` : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      // 44px hit area around the 28px track.
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-(--duration-base) ease-out',
        'after:absolute after:-inset-2 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? (tone === 'success' ? 'bg-success' : 'bg-brand') : 'bg-border-strong',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-6 rounded-full bg-white shadow-md transition-transform duration-(--duration-base) ease-spring',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );

  if (!label) return <span className={className}>{button}</span>;
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div className="min-w-0">
        <p id={`${id}-label`} className="font-semibold text-text">
          {label}
        </p>
        {description && (
          <p id={`${id}-desc`} className="text-sm text-text-muted">
            {description}
          </p>
        )}
      </div>
      {button}
    </div>
  );
}
