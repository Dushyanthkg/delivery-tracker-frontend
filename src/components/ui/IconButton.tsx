'use client';

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Tooltip } from './Tooltip';
import { Spinner } from './Spinner';

type Variant = 'ghost' | 'secondary' | 'soft' | 'primary' | 'glass';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  ghost: 'text-text-muted hover:bg-surface-muted hover:text-text',
  secondary: 'bg-surface text-text shadow-xs ring-1 ring-inset ring-border-strong hover:bg-surface-muted',
  soft: 'bg-brand-soft text-brand-text hover:bg-brand-soft/70',
  primary: 'bg-brand text-brand-fg shadow-sm hover:bg-brand-hover',
  glass: 'bg-glass text-text shadow-md ring-1 ring-inset ring-border backdrop-blur-md hover:bg-surface',
};

// sm is 36px visually with a 44px hit area.
const SIZES: Record<Size, string> = {
  sm: 'size-9 rounded-lg after:absolute after:-inset-1 [&_svg]:size-[18px]',
  md: 'size-11 rounded-xl [&_svg]:size-5',
  lg: 'size-12 rounded-2xl [&_svg]:size-[22px]',
};

interface Common {
  /** Accessible name — also shown as the tooltip. */
  label: string;
  icon: ReactNode;
  variant?: Variant;
  size?: Size;
  /** Show `label` as a tooltip on hover / keyboard focus. */
  tooltip?: boolean;
  loading?: boolean;
  className?: string;
}

type AsButton = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> & { href?: undefined };
type AsLink = Common & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'className'> & { href: string };

/** Square, icon-only button (or link, with `href` — e.g. tel:). Always has an accessible label. */
export function IconButton(props: AsButton | AsLink) {
  const { label, icon, variant = 'ghost', size = 'md', tooltip = true, loading, className, ...rest } = props;
  const classes = cn(
    'relative inline-grid shrink-0 place-items-center transition-[transform,background-color,color] duration-(--duration-fast) ease-out',
    'active:scale-[0.94] disabled:pointer-events-none disabled:opacity-50',
    SIZES[size],
    VARIANTS[variant],
    className,
  );
  const content = loading ? <Spinner size="sm" /> : icon;

  const el =
    'href' in rest && rest.href !== undefined ? (
      <a {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} aria-label={label} className={classes}>
        {content}
      </a>
    ) : (
      <button
        type="button"
        {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
        disabled={(rest as ButtonHTMLAttributes<HTMLButtonElement>).disabled || loading}
        aria-label={label}
        className={classes}
      >
        {content}
      </button>
    );

  return tooltip ? (
    <Tooltip content={label} describe={false}>
      {el}
    </Tooltip>
  ) : (
    el
  );
}
