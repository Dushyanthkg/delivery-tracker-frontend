'use client';

import { cloneElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

const SIDE = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  'bottom-end': 'top-full right-0 mt-2',
  'bottom-start': 'top-full left-0 mt-2',
};

/**
 * Small hover/focus tooltip (WCAG 1.4.13: hoverable, dismissable with Esc, persistent).
 * `describe` wires aria-describedby onto the child; turn it off when the child's
 * accessible name already says the same thing (e.g. an IconButton's label).
 */
export function Tooltip({
  content,
  children,
  side = 'bottom',
  describe = true,
  className,
}: {
  content: ReactNode;
  children: ReactElement<{ 'aria-describedby'?: string }>;
  side?: keyof typeof SIDE;
  describe?: boolean;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <span
      className={cn('relative inline-flex', className)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && show(350)}
      onPointerLeave={hide}
      onFocus={(e) => e.target.matches(':focus-visible') && show(0)}
      onBlur={hide}
    >
      {describe ? cloneElement(children, { 'aria-describedby': open ? id : undefined }) : children}
      {open && (
        <span
          id={id}
          role="tooltip"
          aria-hidden={describe ? undefined : true}
          className={cn(
            'pointer-events-none absolute z-(--z-popover) w-max max-w-64 animate-fade-in rounded-lg bg-text px-2.5 py-1.5 text-xs font-medium leading-snug text-bg shadow-lg',
            SIDE[side],
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
