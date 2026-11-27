'use client';

import { cn } from '@/lib/cn';
import { useTrackingStore, type ConnectionStatus } from '@/store/useTrackingStore';
import { LiveDot } from './Badge';
import { Tooltip } from './Tooltip';

const STYLE: Record<ConnectionStatus, { dot: string; pill: string; label: string; pulse: boolean; help: string }> = {
  idle: {
    dot: 'bg-status-cancelled',
    pill: 'text-text-muted',
    label: 'Offline',
    pulse: false,
    help: 'Not connected to live updates yet.',
  },
  connecting: {
    dot: 'bg-warning',
    pill: 'text-warning-text',
    label: 'Connecting…',
    pulse: true,
    help: 'Opening a live connection to the server.',
  },
  connected: {
    dot: 'bg-success',
    pill: 'text-success-text',
    label: 'Live',
    pulse: true,
    help: 'Connected — positions, ETAs and status changes update in real time.',
  },
  reconnecting: {
    dot: 'bg-warning',
    pill: 'text-warning-text',
    label: 'Reconnecting…',
    pulse: true,
    help: 'Connection dropped. Retrying automatically — the latest data reloads once back.',
  },
  disconnected: {
    dot: 'bg-danger',
    pill: 'text-danger-text',
    label: 'Disconnected',
    pulse: false,
    help: 'Live updates are paused. Check your network connection.',
  },
  unauthorized: {
    dot: 'bg-danger',
    pill: 'text-danger-text',
    label: 'Session expired',
    pulse: false,
    help: 'Your session has expired. Sign in again to resume live updates.',
  },
};

/** Live-connection pill with an animated dot; the tooltip explains the state. */
export function ConnectionIndicator({ className }: { className?: string }) {
  const status = useTrackingStore((s) => s.connection);
  const { dot, pill, label, pulse, help } = STYLE[status];
  return (
    <Tooltip content={help} side="bottom-end">
      <span
        role="status"
        tabIndex={0}
        className={cn(
          'inline-flex h-8 min-w-8 cursor-default items-center justify-center gap-2 rounded-full bg-surface-muted px-3 max-sm:px-0 text-xs font-semibold ring-1 ring-inset ring-border',
          pill,
          className,
        )}
      >
        <LiveDot className={dot} pulse={pulse} />
        {/* Dot-only on phones to leave room for the page title; still announced. */}
        <span className="max-sm:sr-only">{label}</span>
      </span>
    </Tooltip>
  );
}
