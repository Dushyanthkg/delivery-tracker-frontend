'use client';

import { cn } from '@/lib/cn';
import { useTrackingStore, type ConnectionStatus } from '@/store/useTrackingStore';

const STYLE: Record<ConnectionStatus, { dot: string; label: string }> = {
  idle: { dot: 'bg-slate-300', label: 'Offline' },
  connecting: { dot: 'bg-amber-400 animate-pulse', label: 'Connecting…' },
  connected: { dot: 'bg-emerald-500', label: 'Live' },
  reconnecting: { dot: 'bg-amber-400 animate-pulse', label: 'Reconnecting…' },
  disconnected: { dot: 'bg-rose-500', label: 'Disconnected' },
  unauthorized: { dot: 'bg-rose-500', label: 'Session expired' },
};

export function ConnectionIndicator({ className }: { className?: string }) {
  const status = useTrackingStore((s) => s.connection);
  const { dot, label } = STYLE[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium text-slate-600', className)}>
      <span className={cn('h-2 w-2 rounded-full', dot)} />
      {label}
    </span>
  );
}
