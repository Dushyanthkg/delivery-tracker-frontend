'use client';

import { useEffect } from 'react';
import { BellRing } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RouteVisual } from '@/components/order/RouteVisual';
import { useNow } from '@/hooks/useNow';
import { formatDistance, formatDuration } from '@/lib/format';
import type { DispatchOffer } from '@/services/types';

const R = 18;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** Incoming job offer with an accept countdown (the server moves it to the next rider at 0). */
export function OfferCard({
  offer,
  pending,
  onAccept,
  onDecline,
  onExpired,
}: {
  offer: DispatchOffer;
  pending: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onExpired: () => void;
}) {
  const now = useNow(500);
  const left = now == null ? null : Math.max(0, Math.ceil((Date.parse(offer.expiresAt) - now) / 1000));

  useEffect(() => {
    if (left === 0) onExpired();
  }, [left, onExpired]);

  const o = offer.order;
  const fraction = left == null ? 1 : Math.min(1, left / Math.max(1, offer.timeoutSeconds));
  const urgent = left != null && left <= 5;

  return (
    <section
      aria-labelledby={`offer-${offer.offerId}`}
      className="animate-pop-in rounded-2xl bg-surface p-4 shadow-lg ring-2 ring-brand"
    >
      <div className="mb-3 flex items-center gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-brand-fg">
          <BellRing className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`offer-${offer.offerId}`} className="font-semibold text-text">
            New delivery request
          </h2>
          <p className="text-sm text-text-muted">
            <span className="tabular-nums">{formatDistance(offer.pickupDistanceMeters)}</span> to pickup · ~
            {formatDuration(offer.pickupDurationSeconds)}
          </p>
        </div>
        {left != null && (
          <span className="relative grid size-11 shrink-0 place-items-center" role="timer" aria-label={`${left} seconds to respond`}>
            <svg viewBox="0 0 44 44" aria-hidden="true" className="absolute inset-0 -rotate-90">
              <circle cx="22" cy="22" r={R} fill="none" strokeWidth="4" className="stroke-surface-muted" />
              <circle
                cx="22"
                cy="22"
                r={R}
                fill="none"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
                className={urgent ? 'stroke-danger' : 'stroke-brand'}
                style={{ transition: 'stroke-dashoffset 500ms linear' }}
              />
            </svg>
            <span aria-hidden="true" className={urgent ? 'text-sm font-bold tabular-nums text-danger-text' : 'text-sm font-bold tabular-nums text-brand-text'}>
              {left}
            </span>
          </span>
        )}
      </div>

      <RouteVisual pickup={o.pickup.address} dropoff={o.dropoff.address} />
      {o.route && (
        <p className="mt-2 text-xs text-text-muted">
          Trip <span className="tabular-nums">{formatDistance(o.route.distanceMeters)}</span>
        </p>
      )}

      <div className="mt-4 grid grid-cols-[1fr_2fr] gap-2">
        <Button size="lg" variant="secondary" onClick={onDecline} disabled={pending}>
          Decline
        </Button>
        <Button size="lg" variant="success" onClick={onAccept} loading={pending}>
          Accept
        </Button>
      </div>
    </section>
  );
}
