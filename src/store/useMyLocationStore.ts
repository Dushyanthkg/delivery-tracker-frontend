'use client';

import { create } from 'zustand';

export type MyLocationStatus = 'idle' | 'locating' | 'active' | 'denied' | 'unavailable' | 'error';

export interface MyPosition {
  lat: number;
  lng: number;
  /** Radius of uncertainty in metres. */
  accuracy: number;
}

interface MyLocationState {
  status: MyLocationStatus;
  position: MyPosition | null;
  message: string | null;
  /** Bumped whenever the map should fly to the viewer's position. */
  recenterSeq: number;
  /** Start watching (if needed) and centre on the position as soon as it's known. */
  locate: () => void;
}

/**
 * The viewer's own location for the map's "current location" button.
 *
 * One browser watch is shared by all mounted maps and only runs while at least
 * one map is mounted (see `retainMyLocation`) — a route hidden by Cache
 * Components' <Activity> releases it, so GPS doesn't run in the background.
 * Map layers subscribe to this store directly, so position updates don't
 * re-render React.
 */
export const useMyLocationStore = create<MyLocationState>()((set, get) => ({
  status: 'idle',
  position: null,
  message: null,
  recenterSeq: 0,
  locate: () => {
    const { status, position } = get();
    if (status === 'active' && position) {
      set((s) => ({ recenterSeq: s.recenterSeq + 1 }));
      return;
    }
    pendingRecenter = true;
    startWatch();
  },
}));

let watchId: number | null = null;
let retainCount = 0;
/** Centre on the next fix (set by `locate`, cleared after the first fix). */
let pendingRecenter = false;

function startWatch() {
  if (watchId != null) return;
  const set = useMyLocationStore.setState;

  if (typeof window !== 'undefined' && !window.isSecureContext) {
    set({ status: 'unavailable', message: 'Your location needs a secure (HTTPS) connection.' });
    return;
  }
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    set({ status: 'unavailable', message: 'This browser can’t share your location.' });
    return;
  }

  set({ status: 'locating', message: null });
  watchId = navigator.geolocation.watchPosition(
    ({ coords }) => {
      const recenter = pendingRecenter;
      pendingRecenter = false;
      set((s) => ({
        status: 'active',
        message: null,
        position: { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy },
        recenterSeq: recenter ? s.recenterSeq + 1 : s.recenterSeq,
      }));
    },
    (err) => {
      // Keep showing the last known position on transient errors (e.g. timeout while moving).
      if (err.code !== err.PERMISSION_DENIED && useMyLocationStore.getState().position) return;
      stopWatch();
      set({
        status: err.code === err.PERMISSION_DENIED ? 'denied' : 'error',
        message:
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Enable it in your browser settings.'
            : err.message || 'Unable to get your location.',
        position: null,
      });
    },
    { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
  );
}

function stopWatch() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  pendingRecenter = false;
}

/**
 * Called by each mounted map (in an effect). Returns a release function; when
 * the last map releases, the watch stops and the dot is cleared.
 */
export function retainMyLocation(): () => void {
  retainCount++;
  return () => {
    retainCount--;
    if (retainCount > 0) return;
    stopWatch();
    useMyLocationStore.setState({ status: 'idle', position: null, message: null });
  };
}
