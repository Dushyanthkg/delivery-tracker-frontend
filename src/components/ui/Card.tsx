import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn('rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-border', className)} />;
}

export function CardTitle({ children, action, icon }: { children: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-3 flex min-h-8 items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-text [&_svg]:size-4 [&_svg]:text-text-subtle">
        {icon}
        {children}
      </h2>
      {action}
    </div>
  );
}
