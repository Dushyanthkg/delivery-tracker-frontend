import { cn } from '@/lib/cn';
import { STATUS_LABELS } from '@/lib/format';
import type { OrderStatus } from '@/services/types';

const TONE: Record<OrderStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  assigned: 'bg-sky-50 text-sky-800 ring-sky-200',
  picked_up: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  in_transit: 'bg-violet-50 text-violet-800 ring-violet-200',
  delivered: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', TONE[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}
