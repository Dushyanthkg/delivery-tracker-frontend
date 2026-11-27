'use client';

import type { CSSProperties } from 'react';
import { formatClock } from '@/lib/format';
import { useNow } from '@/hooks/useNow';

/** Confetti only for a fresh delivery — reopening an old order stays calm. */
const CELEBRATE_FOR_MS = 10 * 60_000;
const COLORS = ['var(--brand)', 'var(--success)', 'var(--warning)', 'var(--pickup)', 'var(--status-in-transit)'];
const PIECES = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${(i % 6) * 90}ms`,
  drift: `${((i * 53) % 60) - 30}px`,
  spin: `${(i % 2 ? 1 : -1) * (240 + ((i * 71) % 300))}deg`,
  color: COLORS[i % COLORS.length]!,
}));

/** "Delivered" state: drawn check mark + a short confetti burst (hidden under reduced motion). */
export function DeliveredHero({ deliveredAt }: { deliveredAt?: string }) {
  const now = useNow(60_000);
  const fresh = !!deliveredAt && now != null && now - Date.parse(deliveredAt) < CELEBRATE_FOR_MS;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-success-soft p-4">
      {fresh && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-36">
          {PIECES.map((p, i) => (
            <span
              key={i}
              className="confetti-piece"
              style={{ left: p.left, background: p.color, '--delay': p.delay, '--drift': p.drift, '--spin': p.spin } as CSSProperties}
            />
          ))}
        </div>
      )}
      <div className="relative flex items-center gap-4">
        <span className="grid size-14 shrink-0 animate-pop-in place-items-center rounded-full bg-success text-white shadow-lg">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path className="check-draw" d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <div>
          <p className="text-2xl font-bold tracking-tight text-success-text">Delivered</p>
          <p className="text-sm text-text-muted">
            {deliveredAt ? (
              <>
                Dropped off at <time dateTime={deliveredAt}>{formatClock(deliveredAt)}</time>
              </>
            ) : (
              'Your order has arrived.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
