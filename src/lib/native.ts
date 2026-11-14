import { useSyncExternalStore } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';

/** True inside the Capacitor Android/iOS app, false in a normal browser (and during SSR). */
export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}

const noopSubscribe = () => () => {};

/** Hydration-safe isNativeApp() for render: false on the server, real value on the client. */
export function useIsNativeApp(): boolean {
  return useSyncExternalStore(noopSubscribe, isNativeApp, () => false);
}

let bgGeo: BackgroundGeolocationPlugin | null = null;

/**
 * Native background-location plugin (foreground service + persistent notification
 * on Android, so fixes keep arriving with the screen locked or the app backgrounded).
 * Only call when isNativeApp() is true.
 */
export function backgroundGeolocation(): BackgroundGeolocationPlugin {
  bgGeo ??= registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
  return bgGeo;
}

/**
 * Alert the rider (new job offer): vibrate, and in the native app post a system
 * notification so it rings even with the screen locked. No FCM needed — the
 * socket is kept alive by the background-location foreground service.
 */
export async function notifyRider(title: string, body: string): Promise<void> {
  try {
    navigator.vibrate?.([300, 150, 300]);
  } catch {
    // Not supported (iOS Safari) — fine.
  }
  if (!isNativeApp()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    // No `schedule` → shown immediately (no exact-alarm permission needed).
    await LocalNotifications.schedule({ notifications: [{ id: Date.now() % 2_000_000_000, title, body }] });
  } catch {
    // Permission denied — the in-app offer card still shows.
  }
}

/**
 * Android 13+ needs POST_NOTIFICATIONS for the tracking notification to be visible.
 * Tracking still works if denied, but the rider can't see that it's running.
 */
export async function ensureNotificationPermission(): Promise<void> {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== 'granted') await LocalNotifications.requestPermissions();
  } catch {
    // Non-fatal: location tracking doesn't depend on it.
  }
}
