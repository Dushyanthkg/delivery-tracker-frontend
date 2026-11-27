'use client';

import { Check, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatAgo, formatClock, STATUS_LABELS } from '@/lib/format';
import { useNow } from '@/hooks/useNow';
import { STATUS_META } from '@/components/ui/StatusBadge';
import type { Order, OrderStatus } from '@/services/types';

const STEPS: OrderStatus[] = ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered'];
const ROW = 52; // px per step — the progress line is sized from this

type Step = { status: OrderStatus; state: 'done' | 'active' | 'todo' | 'cancelled'; at?: string };

/** Vertical timeline with an animated progress line, absolute + relative times and a distinct cancelled state. */
export function StatusStepper({ order }: { order: Pick<Order, 'status' | 'statusHistory'> }) {
  const now = useNow(30_000);
  const reachedAt = (s: OrderStatus) => order.statusHistory.findLast((e) => e.status === s)?.at;

  let steps: Step[];
  let filled: number; // index the progress line reaches
  if (order.status === 'cancelled') {
    // What actually happened, then the cancellation.
    steps = STEPS.filter((s) => reachedAt(s)).map((s) => ({ status: s, state: 'done', at: reachedAt(s) }));
    steps.push({ status: 'cancelled', state: 'cancelled', at: reachedAt('cancelled') });
    filled = steps.length - 2;
  } else {
    const current = STEPS.indexOf(order.status);
    steps = STEPS.map((s, i) => ({
      status: s,
      state: i < current ? 'done' : i === current ? (s === 'delivered' ? 'done' : 'active') : 'todo',
      at: i <= current ? reachedAt(s) : undefined,
    }));
    filled = current;
  }

  return (
    <ol className="relative" aria-label="Order progress">
      {/* Track + animated fill, centred under the 28px markers */}
      <span aria-hidden="true" className="absolute left-[13px] top-3.5 w-0.5 rounded-full bg-border" style={{ height: (steps.length - 1) * ROW }} />
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-[13px] top-3.5 w-0.5 origin-top rounded-full transition-[height] duration-700 ease-out',
          order.status === 'cancelled' ? 'bg-status-cancelled' : 'bg-brand',
        )}
        style={{ height: Math.max(0, filled) * ROW }}
      />
      {steps.map((step) => {
        const Icon = STATUS_META[step.status].icon;
        return (
          <li
            key={step.status}
            className="relative flex gap-3"
            style={{ height: ROW }}
            aria-current={step.state === 'active' ? 'step' : undefined}
          >
            <span
              className={cn(
                'relative z-10 grid size-7 shrink-0 place-items-center rounded-full transition-colors duration-(--duration-slow)',
                step.state === 'done' && 'bg-brand text-brand-fg',
                step.state === 'active' && 'bg-surface text-brand-text ring-2 ring-brand',
                step.state === 'todo' && 'bg-surface-muted text-text-subtle ring-1 ring-border',
                step.state === 'cancelled' && 'bg-danger text-white',
              )}
            >
              {step.state === 'done' ? (
                <Check aria-hidden="true" className="size-4" strokeWidth={3} />
              ) : step.state === 'cancelled' ? (
                <X aria-hidden="true" className="size-4" strokeWidth={3} />
              ) : (
                <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
              )}
              {step.state === 'active' && <span aria-hidden="true" className="absolute inset-0 animate-live-ping rounded-full ring-2 ring-brand/60" />}
            </span>
            <div className="flex min-w-0 flex-1 items-start justify-between gap-2 pt-1">
              <span
                className={cn(
                  'text-sm',
                  step.state === 'active' && 'font-semibold text-text',
                  step.state === 'done' && 'font-medium text-text',
                  step.state === 'todo' && 'text-text-subtle',
                  step.state === 'cancelled' && 'font-semibold text-danger-text',
                )}
              >
                {STATUS_LABELS[step.status]}
                <span className="sr-only">
                  {step.state === 'done' ? ' (done)' : step.state === 'active' ? ' (current)' : step.state === 'todo' ? ' (upcoming)' : ''}
                </span>
              </span>
              {step.at && (
                <span className="shrink-0 text-right text-xs leading-tight tabular-nums">
                  <time dateTime={step.at} className="block font-medium text-text-muted">
                    {formatClock(step.at)}
                  </time>
                  {now != null && <span className="block text-text-subtle">{formatAgo(Date.parse(step.at), now)}</span>}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
