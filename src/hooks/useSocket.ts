'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { acquireSocket, getCurrentSocket, releaseSocket, subscribeSocket, type AppSocket } from '@/services/socket';
import { useAuthStore } from '@/store/useAuthStore';
import { useTrackingStore } from '@/store/useTrackingStore';
import type { ServerToClientEvents } from '@/services/types';

/**
 * Connection lifecycle + auto-reconnect.
 * Socket.io's manager handles exponential-backoff reconnection; on top of that
 * we reconnect after a server-initiated disconnect, when the tab becomes
 * visible again and when the browser comes back online.
 */
export function useSocket(): AppSocket | null {
  const token = useAuthStore((s) => s.token);
  const socket = useSyncExternalStore(subscribeSocket, getCurrentSocket, () => null);

  useEffect(() => {
    if (!token) return;
    const s = acquireSocket(token);
    const { setConnection } = useTrackingStore.getState();
    setConnection(s.connected ? 'connected' : 'connecting');

    const onConnect = () => setConnection('connected');
    const onDisconnect = (reason: string) => {
      setConnection('disconnected');
      // Server kicked us (e.g. deploy restart) — socket.io won't auto-retry this one.
      if (reason === 'io server disconnect') s.connect();
    };
    const onConnectError = (err: Error) => {
      if (err.message === 'INVALID_TOKEN' || err.message === 'UNAUTHORIZED') {
        setConnection('unauthorized');
        useAuthStore.getState().logout();
      } else {
        setConnection('reconnecting');
      }
    };
    const onReconnectAttempt = () => setConnection('reconnecting');
    const wake = () => {
      if (!s.connected && document.visibilityState === 'visible') s.connect();
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);
    s.io.on('reconnect_attempt', onReconnectAttempt);
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.io.off('reconnect_attempt', onReconnectAttempt);
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake);
      releaseSocket();
    };
  }, [token]);

  return token ? socket : null;
}

/** Subscribe to a server event; the latest handler is always used without re-subscribing. */
export function useSocketEvent<E extends keyof ServerToClientEvents>(
  socket: AppSocket | null,
  event: E,
  handler: ServerToClientEvents[E],
): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });

  useEffect(() => {
    if (!socket) return;
    const listener = ((...args: Parameters<ServerToClientEvents[E]>) =>
      (ref.current as (...a: typeof args) => void)(...args)) as ServerToClientEvents[E];
    // socket.io-client's generic overloads don't narrow well here; the cast is safe.
    (socket.on as (e: E, l: ServerToClientEvents[E]) => void)(event, listener);
    return () => {
      (socket.off as (e: E, l: ServerToClientEvents[E]) => void)(event, listener);
    };
  }, [socket, event]);
}

/** Run `fn` on every (re)connect, and immediately if already connected. */
export function useOnConnect(socket: AppSocket | null, fn: () => void, deps: unknown[] = []): void {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    if (!socket) return;
    const run = () => ref.current();
    if (socket.connected) run();
    socket.on('connect', run);
    return () => {
      socket.off('connect', run);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, ...deps]);
}
