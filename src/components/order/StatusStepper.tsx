import { cn } from '@/lib/cn';
import { formatClock, STATUS_LABELS } from '@/lib/format';
import type { Order, OrderStatus } from '@/services/types';

const STEPS: OrderStatus[] = ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered'];

export function StatusStepper({ order }: { order: Pick<Order, 'status' | 'statusHistory'> }) {
  if (order.status === 'cancelled') {
    return <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">This order was cancelled.</p>;
  }
  const currentIndex = STEPS.indexOf(order.status);
  const reachedAt = (s: OrderStatus) => order.statusHistory.findLast((e) => e.status === s)?.at;

  return (
    <ol className="space-y-0">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const at = i <= currentIndex ? reachedAt(step) : undefined;
        return (
          <li key={step} className="relative flex gap-3 pb-4 last:pb-0">
            {i < STEPS.length - 1 && (
              <span className={cn('absolute left-[11px] top-6 h-full w-0.5', done ? 'bg-indigo-600' : 'bg-slate-200')} />
            )}
            <span
              className={cn(
                'relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold',
                done && 'bg-indigo-600 text-white',
                active && 'bg-white text-indigo-600 ring-2 ring-indigo-600',
                !done && !active && 'bg-slate-100 text-slate-400 ring-1 ring-slate-200',
              )}
            >
              {done ? '✓' : i + 1}
              {active && step !== 'delivered' && (
                <span className="absolute inset-0 animate-ping rounded-full ring-2 ring-indigo-400 opacity-40" />
              )}
            </span>
            <div className="flex flex-1 items-baseline justify-between gap-2 pt-0.5">
              <span className={cn('text-sm', active ? 'font-semibold text-slate-900' : done ? 'text-slate-700' : 'text-slate-400')}>
                {STATUS_LABELS[step]}
              </span>
              {at && <span className="text-xs tabular-nums text-slate-400">{formatClock(at)}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
