import { io, type Socket } from 'socket.io-client';
import { config } from '@/lib/config';
import { useAuthStore } from '@/store/useAuthStore';
import type { ClientToServerEvents, ServerToClientEvents, SocketAck } from './types';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * One shared connection per tab, reference-counted across components.
 * Release is deferred briefly so route transitions (and React StrictMode's
 * double effects) don't tear down and rebuild the connection.
 */
let socket: AppSocket | null = null;
let socketToken: string | null = null;
let refCount = 0;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

const RELEASE_DELAY_MS = 5_000;

/* Observable "current socket" so React can read it via useSyncExternalStore. */
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
export function subscribeSocket(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const getCurrentSocket = (): AppSocket | null => socket;
export const ACK_TIMEOUT_MS = 8_000;

export function acquireSocket(token: string): AppSocket {
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  if (socket && socketToken !== token) {
    socket.disconnect();
    socket = null;
  }
  if (!socket) {
    socketToken = token;
    socket = io(config.apiUrl, {
      // Callback form → every (re)connect sends the *current* token.
      auth: (cb) => cb({ token: useAuthStore.getState().token ?? token }),
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      randomizationFactor: 0.5,
      timeout: 10_000,
    });
    notify();
  }
  refCount++;
  return socket;
}

export function releaseSocket(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0 || releaseTimer) return;
  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    if (refCount === 0 && socket) {
      socket.disconnect();
      socket = null;
      socketToken = null;
      notify();
    }
  }, RELEASE_DELAY_MS);
}

/** Immediately drop the connection (logout). */
export function destroySocket(): void {
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = null;
  refCount = 0;
  socket?.disconnect();
  socket = null;
  socketToken = null;
  notify();
}

/* ---------- Typed ack helper ---------- */

type Args<E extends keyof ClientToServerEvents> = Parameters<ClientToServerEvents[E]>;
type AckCallback<E extends keyof ClientToServerEvents> = Extract<Args<E>[number], (res: never) => void>;
/** Result type delivered to the event's ack callback. */
export type AckResult<E extends keyof ClientToServerEvents> =
  AckCallback<E> extends (res: infer R) => void ? R : never;
/** Arguments before the ack callback. */
type PayloadArgs<E extends keyof ClientToServerEvents> =
  Args<E> extends [infer P, unknown?] ? (P extends (...a: never[]) => unknown ? [] : [P]) : [];

/**
 * Emit with acknowledgement + timeout, fully typed from ClientToServerEvents.
 * Never throws: a timeout becomes `{ ok: false, error: { code: 'ACK_TIMEOUT' } }`.
 */
export async function emitWithAck<E extends keyof ClientToServerEvents>(
  s: AppSocket,
  event: E,
  ...payload: PayloadArgs<E>
): Promise<AckResult<E>> {
  try {
    const timed = s.timeout(ACK_TIMEOUT_MS);
    const emit = timed.emitWithAck as (ev: E, ...a: unknown[]) => Promise<AckResult<E>>;
    return await emit.call(timed, event, ...payload);
  } catch {
    const timeout: SocketAck<never> = { ok: false, error: { code: 'ACK_TIMEOUT', message: 'Server did not respond in time' } };
    return timeout as AckResult<E>;
  }
}
