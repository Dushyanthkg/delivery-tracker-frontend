import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Horizontal rule, optionally with a centred label. */
export function Divider({ label, className }: { label?: ReactNode; className?: string }) {
  if (!label) return <hr className={cn('border-0 border-t border-border', className)} />;
  return (
    <div role="separator" className={cn('flex items-center gap-3 text-xs font-medium text-text-subtle', className)}>
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
