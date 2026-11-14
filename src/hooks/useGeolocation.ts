'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { config } from '@/lib/config';
import { bearing, haversine } from '@/lib/geo';
import { backgroundGeolocation, ensureNotificationPermission, isNativeApp } from '@/lib/native';
import type { GeoPosition } from '@/services/types';

export type GeoStatus = 'idle' | 'watching' | 'denied' | 'unavailable' | 'error';

interface Options {
  enabled: boolean;
  onEmit: (pos: GeoPosition) => void;
  minIntervalMs?: number;
  maxIntervalMs?: number;
  minDistanceM?: number;
}

/** In the native app, don't heartbeat a fix older than this (the location service may have died). */
const NATIVE_MAX_FIX_AGE_MS = 30_000;

type FixHandler = (pos: GeoPosition) => void;
type ErrorHandler = (status: Exclude<GeoStatus, 'idle' | 'watching'>, message: string) => void;

/** Browser source: navigator.geolocation. Pauses when the screen locks / tab is hidden. */
function startWebWatcher(onFix: FixHandler, onError: ErrorHandler): () => void {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    const t = setTimeout(() => onError('unavailable', 'Geolocation is not supported by this browser'), 0);
    return () => clearTimeout(t);
  }
  const watchId = navigator.geolocation.watchPosition(
    ({ coords }) =>
      onFix({
        lat: coords.latitude,
        lng: coords.longitude,
        heading: coords.heading,
        speed: coords.speed,
        accuracy: coords.accuracy,
        timestamp: new Date().toISOString(),
      }),
    (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        onError('denied', 'Location permission denied. Enable it in your browser settings.');
      } else {
        onError('error', err.message || 'Unable to get location');
      }
    },
    { enableHighAccuracy: true, maximumAge: 2_000, timeout: 20_000 },
  );
  return () => navigator.geolocation.clearWatch(watchId);
}

/**
 * Native source (Capacitor app): a foreground service with a persistent notification,
 * so fixes keep arriving with the screen locked or the app in the background.
 */
function startNativeWatcher(onFix: FixHandler, onError: ErrorHandler): () => void {
  const plugin = backgroundGeolocation();
  let watcherId: string | null = null;
  let cancelled = false;

  void (async () => {
    await ensureNotificationPermission();
    if (cancelled) return;
    try {
      const id = await plugin.addWatcher(
        {
          backgroundTitle: 'Delivery in progress',
          backgroundMessage: 'Sharing your live location with the customer.',
          requestPermissions: true,
          stale: false,
          // Our own throttle applies the 10 m / 3–5 s policy; let every fix through.
          distanceFilter: 0,
        },
        (location, error) => {
          if (error) {
            if (error.code === 'NOT_AUTHORIZED') {
              onError('denied', 'Location permission denied. Allow location for Delivery Rider in Settings.');
            } else {
              onError('error', error.message || 'Unable to get location');
            }
            return;
          }
          if (!location) return;
          onFix({
            lat: location.latitude,
            lng: location.longitude,
            heading: location.bearing,
            speed: location.speed,
            accuracy: location.accuracy,
            timestamp: new Date(location.time ?? Date.now()).toISOString(),
          });
        },
      );
      if (cancelled) void plugin.removeWatcher({ id });
      else watcherId = id;
    } catch (err) {
      if (!cancelled) onError('error', err instanceof Error ? err.message : 'Unable to start location tracking');
    }
  })();

  return () => {
    cancelled = true;
    if (watcherId) void plugin.removeWatcher({ id: watcherId });
  };
}

/**
 * Throttled GPS watcher (battery & bandwidth friendly).
 *
 * Fixes may arrive many times per second. We only emit when:
 *   - ≥ minIntervalMs (3 s) since the last emit AND moved ≥ minDistanceM (10 m), or
 *   - ≥ maxIntervalMs (5 s) since the last emit (heartbeat, keeps "last seen" fresh
 *     even when parked — browsers stop firing watchPosition when stationary).
 *
 * In the Capacitor app the native background plugin is used instead of the browser API.
 */
export function useGeolocation({
  enabled,
  onEmit,
  minIntervalMs = config.gps.minIntervalMs,
  maxIntervalMs = config.gps.maxIntervalMs,
  minDistanceM = config.gps.minDistanceM,
}: Options) {
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const onEmitRef = useRef(onEmit);
  useEffect(() => {
    onEmitRef.current = onEmit;
  });

  useEffect(() => {
    if (!enabled) return;

    const native = isNativeApp();
    let latest: GeoPosition | null = null;
    let latestAt = 0;
    let lastEmitted: GeoPosition | null = null;
    let lastEmitAt = 0;

    const emit = (pos: GeoPosition) => {
      // Fixes carry heading only while moving; derive it from displacement otherwise.
      let heading = pos.heading;
      if ((heading == null || Number.isNaN(heading)) && lastEmitted && haversine(lastEmitted, pos) > 3) {
        heading = bearing(lastEmitted, pos);
      }
      const out: GeoPosition = { ...pos, heading: heading ?? lastEmitted?.heading ?? null };
      lastEmitted = out;
      lastEmitAt = Date.now();
      onEmitRef.current(out);
    };

    const maybeEmit = () => {
      if (!latest) return;
      if (native) {
        // Native fixes keep flowing in the background; only guard against a dead service.
        if (Date.now() - latestAt > NATIVE_MAX_FIX_AGE_MS) return;
      } else if (document.visibilityState === 'hidden') {
        // While hidden/locked the browser stops delivering fixes, so `latest` goes stale.
        // Don't heartbeat it with a fresh timestamp — that would show an old spot as live.
        return;
      }
      const elapsed = Date.now() - lastEmitAt;
      const moved = lastEmitted ? haversine(lastEmitted, latest) : Infinity;
      if ((elapsed >= minIntervalMs && moved >= minDistanceM) || elapsed >= maxIntervalMs) {
        emit({ ...latest, timestamp: new Date().toISOString() });
      }
    };

    const onFix: FixHandler = (pos) => {
      setStatus('watching');
      setError(null);
      latest = pos;
      latestAt = Date.now();
      maybeEmit();
    };
    const onError: ErrorHandler = (s, message) => {
      setStatus(s);
      setError(message);
    };

    const stopSource = native ? startNativeWatcher(onFix, onError) : startWebWatcher(onFix, onError);
    const heartbeat = setInterval(maybeEmit, 1_000);

    return () => {
      stopSource();
      clearInterval(heartbeat);
      // Reset for the next session (runs outside render, in cleanup).
      setStatus('idle');
      setError(null);
    };
  }, [enabled, minIntervalMs, maxIntervalMs, minDistanceM]);

  /** Native app only: jump to the OS app settings (e.g. after permission was denied). */
  const openSettings = useCallback(() => {
    if (isNativeApp()) void backgroundGeolocation().openSettings();
  }, []);

  // Derived rather than set-in-effect: disabled always reads as idle.
  return enabled
    ? { status, error, openSettings }
    : { status: 'idle' as GeoStatus, error: null, openSettings };
}
