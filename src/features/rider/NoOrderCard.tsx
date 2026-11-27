'use client';

import { Inbox, MapPin, Radio } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Field';
import { LiveDot } from '@/components/ui/Badge';

/** Idle state: no job yet. Online riders share location to be offered nearby orders. */
export function NoOrderCard({
  isOnline,
  sharing,
  watching,
  gpsError,
  onShare,
}: {
  isOnline: boolean;
  sharing: boolean;
  watching: boolean;
  gpsError: string | null;
  onShare: () => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl bg-surface-muted/60 p-4 ring-1 ring-inset ring-border">
      <div className="flex gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-text">
          <Inbox className="size-5" />
        </span>
        <div>
          <p className="font-semibold text-text">No active order</p>
          <p className="text-sm text-text-muted">Stay online and share your location — nearby orders are offered to you automatically.</p>
        </div>
      </div>
      {isOnline &&
        (sharing ? (
          <p role="status" className="flex items-center gap-2 text-sm font-medium text-success-text">
            {watching ? <LiveDot pulse className="bg-success" /> : <Radio aria-hidden="true" className="size-4" />}
            {watching ? 'Sharing location — waiting for orders nearby' : 'Waiting for GPS fix…'}
          </p>
        ) : (
          <Button className="w-full" size="lg" variant="secondary" onClick={onShare} leftIcon={<MapPin aria-hidden="true" />}>
            Share location to get orders
          </Button>
        ))}
      {gpsError && sharing && <Alert>{gpsError}</Alert>}
    </div>
  );
}
