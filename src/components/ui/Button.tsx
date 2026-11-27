import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'success' | 'glass';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-fg shadow-sm hover:bg-brand-hover',
  secondary: 'bg-surface text-text shadow-xs ring-1 ring-inset ring-border-strong hover:bg-surface-muted',
  soft: 'bg-brand-soft text-brand-text hover:bg-brand-soft/70',
  ghost: 'text-text-muted hover:bg-surface-muted hover:text-text',
  danger: 'bg-danger text-white shadow-sm hover:bg-danger/90',
  success: 'bg-success text-white shadow-sm hover:bg-success/90',
  glass: 'bg-glass text-text shadow-md ring-1 ring-inset ring-border backdrop-blur-md hover:bg-surface',
};

const SIZES: Record<ButtonSize, string> = {
  // sm is 36px visually; the ::after extends the hit area to 44px.
  sm: 'h-9 gap-1.5 rounded-lg px-3 text-sm after:absolute after:-inset-y-1 after:inset-x-0',
  md: 'h-11 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-5 text-base',
  xl: 'h-14 gap-2.5 rounded-2xl px-6 text-base',
};

/** Classes for anything that should look like a button (e.g. a Next <Link>). */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    'relative inline-flex select-none items-center justify-center whitespace-nowrap font-semibold',
    'transition-[transform,background-color,color,box-shadow] duration-(--duration-fast) ease-out',
    'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    '[&_svg]:size-[1.15em] [&_svg]:shrink-0',
    SIZES[size],
    VARIANTS[variant],
    className,
  );
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  leftIcon,
  rightIcon,
  className,
  children,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
    >
      {loading ? <Spinner size="sm" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}
