'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface Segment<T extends string | number> {
  value: T;
  label: ReactNode;
  /** Accessible name when `label` is an icon. */
  ariaLabel?: string;
}

/** Radio-group of pill buttons with arrow-key navigation (roving tabindex). */
export function SegmentedControl<T extends string | number>({
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
  size = 'md',
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Segment<T>[];
  'aria-label': string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(e: KeyboardEvent, i: number) {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('inline-flex rounded-xl bg-surface-muted p-1 ring-1 ring-inset ring-border', className)}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.ariaLabel}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'relative inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg font-semibold tabular-nums transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-out [&_svg]:size-4',
              size === 'sm' ? 'h-8 min-w-9 px-2.5 text-xs after:absolute after:-inset-y-1.5 after:inset-x-0' : 'h-10 min-w-11 px-3 text-sm',
              active ? 'bg-surface text-text shadow-sm ring-1 ring-border' : 'text-text-muted hover:text-text',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
