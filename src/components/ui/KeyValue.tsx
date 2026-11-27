import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Definition list of label/value rows. Use <KeyValue> children inside. */
export function KeyValueList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('divide-y divide-border', className)}>{children}</dl>;
}

export function KeyValue({ label, icon, children }: { label: ReactNode; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0">
      <dt className="flex shrink-0 items-center gap-2 text-text-muted [&_svg]:size-4 [&_svg]:text-text-subtle">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0 text-right font-medium text-text">{children}</dd>
    </div>
  );
}
