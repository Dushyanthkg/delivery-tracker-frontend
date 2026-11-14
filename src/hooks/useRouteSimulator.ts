'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { config } from '@/lib/config';
import { buildPathIndex, pointAlong, type PathIndex } from '@/lib/geo';
import type { GeoPosition, LatLng } from '@/services/types';

interface Options {
  onEmit: (pos: GeoPosition) => void;
  onFinish?: () => void;
  /** Real-world speed in m/s before the multiplier (default ≈ 30 km/h). */
  baseSpeedMps?: number;
  tickMs?: number;
}

/**
 * Desktop simulation: walks a polyline, emitting a GPS-like fix every tick.
 * Uses the same cadence as real GPS so the whole pipeline (throttle, ETA,
 * marker interpolation) is exercised exactly as in production.
 */
export function useRouteSimulator({
  onEmit,
  onFinish,
  baseSpeedMps = 8.3,
  tickMs = config.gps.minIntervalMs,
}: Options) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [multiplier, setMultiplier] = useState(1);

  const pathRef = useRef<PathIndex | null>(null);
  const travelledRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const multiplierRef = useRef(multiplier);
  const cbRef = useRef({ onEmit, onFinish });
  useEffect(() => {
    cbRef.current = { onEmit, onFinish };
    multiplierRef.current = multiplier;
  });

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRunning(false);
  }, []);

  const tick = useCallback(() => {
    const path = pathRef.current;
    if (!path) return;
    const speed = baseSpeedMps * multiplierRef.current;
    const { position, heading } = pointAlong(path, travelledRef.current);
    cbRef.current.onEmit({
      ...position,
      heading,
      speed: baseSpeedMps, // report a realistic speed so server ETA stays sane
      accuracy: 5,
      timestamp: new Date().toISOString(),
    });
    setProgress(path.total > 0 ? Math.min(1, travelledRef.current / path.total) : 1);

    if (travelledRef.current >= path.total) {
      stop();
      cbRef.current.onFinish?.();
      return;
    }
    travelledRef.current = Math.min(path.total, travelledRef.current + speed * (tickMs / 1000));
  }, [baseSpeedMps, tickMs, stop]);

  const start = useCallback(
    (points: LatLng[]) => {
      if (points.length < 2) return;
      stop();
      pathRef.current = buildPathIndex(points);
      travelledRef.current = 0;
      setProgress(0);
      setRunning(true);
      tick(); // emit the start position immediately
      timerRef.current = setInterval(tick, tickMs);
    },
    [stop, tick, tickMs],
  );

  // Clean up on unmount / when the route is hidden (Activity).
  useEffect(() => stop, [stop]);

  return { running, progress, multiplier, setMultiplier, start, stop };
}
