'use client';

import { Switch } from '@/components/ui/Switch';
import { cn } from '@/lib/cn';

/** Shift toggle: online riders are visible to dispatch and receive offers. */
export function OnlineCard({ isOnline, onChange }: { isOnline: boolean; onChange: (next: boolean) => void }) {
  return (
    <div
      className={cn(
        'rounded-2xl p-4 ring-1 ring-inset transition-colors duration-(--duration-base)',
        isOnline ? 'bg-success-soft ring-success/25' : 'bg-surface-muted ring-border',
      )}
    >
      <Switch
        checked={isOnline}
        onChange={onChange}
        label={isOnline ? 'You are online' : 'You are offline'}
        description={isOnline ? 'Visible to dispatch' : 'Go online to receive orders'}
      />
    </div>
  );
}
