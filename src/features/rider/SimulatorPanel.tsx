'use client';

import { Bike, FlaskConical, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

const SPEEDS = [1, 3, 10];

/**
 * Desktop-testing tool: walks the route without a real GPS. Deliberately quiet
 * (dashed, muted) so it never competes with the real delivery controls.
 */
export function SimulatorPanel({
  mode,
  multiplier,
  onMultiplier,
  progress,
  heading,
  onStart,
  onStop,
}: {
  mode: 'off' | 'gps' | 'sim';
  multiplier: number;
  onMultiplier: (m: number) => void;
  progress: number;
  heading: 'pickup' | 'dropoff';
  onStart: () => void;
  onStop: () => void;
}) {
  const pct = Math.round(progress * 100);
  return (
    <section aria-labelledby="sim-title" className="rounded-2xl border border-dashed border-border-strong p-4">
      <h2 id="sim-title" className="mb-3 flex items-center gap-2 text-xs font-semibold text-text-muted">
        <FlaskConical aria-hidden="true" className="size-4 text-text-subtle" />
        Desktop testing
      </h2>
      <div className="flex gap-2">
        {mode === 'sim' ? (
          <Button className="flex-1" variant="secondary" size="sm" onClick={onStop} leftIcon={<Square aria-hidden="true" />}>
            Stop simulation
          </Button>
        ) : (
          <Button className="flex-1" variant="secondary" size="sm" onClick={onStart} disabled={mode === 'gps'} leftIcon={<Bike aria-hidden="true" />}>
            Simulate Rider Route
          </Button>
        )}
        <SegmentedControl
          aria-label="Simulation speed"
          size="sm"
          value={multiplier}
          onChange={onMultiplier}
          options={SPEEDS.map((m) => ({ value: m, label: `${m}×` }))}
        />
      </div>
      {mode === 'sim' && (
        <div className="mt-3">
          <div
            role="progressbar"
            aria-label="Simulation progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
          >
            <div className="h-full rounded-full bg-text-subtle transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-xs tabular-nums text-text-muted">
            {heading === 'pickup' ? 'Driving to pickup' : 'Driving to drop-off'} · {pct}%
          </p>
        </div>
      )}
    </section>
  );
}
