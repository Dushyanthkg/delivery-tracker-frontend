'use client';

import { createContext, useContext, useId, type ComponentProps, type ReactNode, type SelectHTMLAttributes } from 'react';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { cn } from '@/lib/cn';

const inputClass = cn(
  'block h-11 w-full rounded-xl border-0 bg-surface px-3.5 text-[15px] text-text shadow-xs ring-1 ring-inset ring-border-strong',
  'placeholder:text-text-subtle transition-shadow duration-(--duration-fast)',
  'focus:outline-none focus:ring-2 focus:ring-brand',
  'aria-invalid:ring-danger aria-invalid:focus:ring-danger',
  'disabled:cursor-not-allowed disabled:opacity-60',
);

/** Lets Input/Select inside a Field pick up its hint/error ids and invalid state. */
const FieldContext = createContext<{ describedBy?: string; invalid: boolean } | null>(null);

export function Field({
  label,
  children,
  hint,
  error,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  /** Inline validation message; marks the control aria-invalid. */
  error?: ReactNode;
  className?: string;
}) {
  const id = useId();
  const describedBy = [error && `${id}-err`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <FieldContext value={{ describedBy, invalid: !!error }}>
      <label className={cn('block space-y-1.5', className)}>
        <span className="text-sm font-medium text-text">{label}</span>
        {children}
        {error && (
          <span id={`${id}-err`} className="flex items-center gap-1.5 text-xs font-medium text-danger-text">
            <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
            {error}
          </span>
        )}
        {hint && (
          <span id={`${id}-hint`} className="block text-xs text-text-muted">
            {hint}
          </span>
        )}
      </label>
    </FieldContext>
  );
}

interface InputProps extends ComponentProps<'input'> {
  /** Icon inside the field on the left. */
  leading?: ReactNode;
  /** Element inside the field on the right (e.g. a show-password IconButton). */
  trailing?: ReactNode;
}

export function Input({ className, leading, trailing, ...rest }: InputProps) {
  const ctx = useContext(FieldContext);
  const input = (
    <input
      aria-describedby={ctx?.describedBy}
      aria-invalid={ctx?.invalid || undefined}
      {...rest}
      className={cn(inputClass, !!leading && 'pl-10', !!trailing && 'pr-12', className)}
    />
  );
  if (!leading && !trailing) return input;
  return (
    <span className="relative block">
      {leading && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center [&_svg]:size-[18px]">
          {leading}
        </span>
      )}
      {input}
      {trailing && <span className="absolute inset-y-0 right-1 flex items-center">{trailing}</span>}
    </span>
  );
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  const ctx = useContext(FieldContext);
  return <select aria-describedby={ctx?.describedBy} {...rest} className={cn(inputClass, 'pr-9', className)} />;
}

const ALERT = {
  error: { icon: CircleAlert, className: 'bg-danger-soft text-danger-text ring-danger/25' },
  info: { icon: Info, className: 'bg-info-soft text-info-text ring-info/25' },
  success: { icon: CircleCheck, className: 'bg-success-soft text-success-text ring-success/25' },
};

export function Alert({ children, tone = 'error', className }: { children: ReactNode; tone?: 'error' | 'info' | 'success'; className?: string }) {
  const { icon: Icon, className: toneClass } = ALERT[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm ring-1 ring-inset', toneClass, className)}
    >
      <Icon aria-hidden="true" className="mt-px size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
