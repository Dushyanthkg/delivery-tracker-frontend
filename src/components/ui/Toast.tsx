'use client';

import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  /** ms; 0 keeps it until dismissed. */
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, 'id' | 'duration'> & { id?: string; duration?: number }) => string;
  dismiss: (id: string) => void;
}

let seq = 0;
const MAX_TOASTS = 3;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: ({ id = `t${++seq}`, duration, ...t }) => {
    const item: ToastItem = { id, duration: duration ?? (t.tone === 'error' ? 8_000 : 4_500), ...t };
    // Same id replaces in place (e.g. one "rider notice" slot), newest last.
    set((s) => ({ toasts: [...s.toasts.filter((x) => x.id !== id), item].slice(-MAX_TOASTS) }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

type Opts = { id?: string; description?: string; duration?: number };

/** Fire-and-forget notifications. Callable from anywhere (event handlers, socket callbacks). */
export const toast = {
  success: (title: string, o?: Opts) => useToastStore.getState().push({ tone: 'success', title, ...o }),
  error: (title: string, o?: Opts) => useToastStore.getState().push({ tone: 'error', title, ...o }),
  info: (title: string, o?: Opts) => useToastStore.getState().push({ tone: 'info', title, ...o }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};

const TONE = {
  success: { icon: CircleCheck, className: 'text-success-text' },
  error: { icon: CircleAlert, className: 'text-danger-text' },
  info: { icon: Info, className: 'text-info-text' },
};

/** Renders the toast stack. Mounted once in the root layout. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      aria-relevant="additions text"
      className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+4rem)] z-(--z-toast) flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastCard({ toast: t }: { toast: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const paused = useRef(false);
  const { icon: Icon, className } = TONE[t.tone];

  useEffect(() => {
    if (!t.duration) return;
    let left = t.duration;
    const step = 250;
    const id = setInterval(() => {
      if (paused.current) return;
      left -= step;
      if (left <= 0) dismiss(t.id);
    }, step);
    return () => clearInterval(id);
    // Restart the timer when a toast with the same id is replaced.
  }, [t, dismiss]);

  return (
    <div
      role={t.tone === 'error' ? 'alert' : 'status'}
      onPointerEnter={() => (paused.current = true)}
      onPointerLeave={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onBlur={() => (paused.current = false)}
      className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-2xl bg-surface-raised p-3 pr-2 shadow-xl ring-1 ring-border"
    >
      <Icon aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', className)} />
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-sm font-semibold text-text">{t.title}</p>
        {t.description && <p className="mt-0.5 text-sm text-text-muted">{t.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => dismiss(t.id)}
        aria-label="Dismiss notification"
        className="relative -my-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-text-subtle transition-colors hover:bg-surface-muted hover:text-text after:absolute after:-inset-1.5"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
