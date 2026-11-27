'use client';

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { useMediaQuery } from '@/hooks/useMediaQuery';

type Snap = 'peek' | 'half' | 'full';
const ORDER: Snap[] = ['peek', 'half', 'full'];

const HANDLE_H = 28;
const TOP_GAP = 12;
/** Floating panel width + its left offset + gap — the map keeps fitted content clear of it. */
const PANEL_INSET_LG = 400 + 16 + 16;

/**
 * Full-bleed map with one panel of content over it:
 *  - phones/tablets: a draggable bottom sheet (peek / half / full). `peek` is
 *    always visible and sets the collapsed height; `children` scroll below it.
 *  - lg+: a floating glass panel on the left.
 *
 * The panel is a single DOM tree restyled per breakpoint, so its state (and any
 * data it fetches) is never duplicated. It publishes --map-inset-bottom /
 * --map-inset-left so map controls and fit-to-bounds stay clear of it.
 */
export function MapScreen({
  map,
  peek,
  children,
  label,
  overlay,
}: {
  map: ReactNode;
  peek: ReactNode;
  children?: ReactNode;
  /** Accessible name of the panel region. */
  label: string;
  /** Extra floating UI over the map (top), e.g. a hint pill. */
  overlay?: ReactNode;
}) {
  // lg+ → floating panel; phones (and the server render) → bottom sheet.
  const isLg = useMediaQuery('(min-width: 1024px)');
  const rootRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<Snap>('peek');
  const [size, setSize] = useState({ container: 0, peek: 0 });
  const drag = useRef<{ startY: number; startH: number; lastY: number; lastT: number; v: number; moved: boolean } | null>(null);

  // Measure container + peek content (layout effect: the map reads the insets on its first fit).
  useLayoutEffect(() => {
    const root = rootRef.current;
    const peekEl = peekRef.current;
    if (!root || !peekEl) return;
    const measure = () => setSize({ container: root.clientHeight, peek: peekEl.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    ro.observe(peekEl);
    return () => ro.disconnect();
  }, []);

  const heights = useCallback(
    (s: Snap) => {
      const { container, peek: peekContent } = size;
      if (!container) return 0;
      const full = container - TOP_GAP;
      const peekH = Math.min(HANDLE_H + peekContent + 8, Math.round(container * 0.62), full);
      if (s === 'peek') return peekH;
      if (s === 'half') return Math.min(full, Math.max(peekH + 80, Math.round(container * 0.55)));
      return full;
    },
    [size],
  );

  const setHeight = (h: number) => {
    if (sheetRef.current) sheetRef.current.style.height = `${h}px`;
  };

  const goTo = (s: Snap) => {
    setHeight(heights(s));
    setSnap(s);
  };

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    if (isLg || e.button !== 0) return;
    // Let buttons, links and inputs in the peek area work normally.
    if ((e.target as HTMLElement).closest('a,button:not([data-sheet-handle]),input,select,textarea,label,[role="switch"]')) return;
    const el = sheetRef.current;
    if (!el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startH: el.offsetHeight, lastY: e.clientY, lastT: e.timeStamp, v: 0, moved: false };
    el.dataset.dragging = '';
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > 4) d.moved = true;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = (e.clientY - d.lastY) / dt; // px/ms, + = downwards
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    setHeight(Math.max(heights('peek') * 0.85, Math.min(heights('full'), d.startH - dy)));
  }

  function onPointerUp(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    const el = sheetRef.current;
    drag.current = null;
    if (!d || !el) return;
    delete el.dataset.dragging;
    if (!d.moved) {
      // Tap on the handle cycles; taps elsewhere in the peek area do nothing.
      if ((e.target as HTMLElement).closest('[data-sheet-handle]')) goTo(ORDER[(ORDER.indexOf(snap) + 1) % ORDER.length]!);
      else setHeight(heights(snap));
      return;
    }
    // Project the release with a little momentum, then pick the nearest snap.
    const projected = el.offsetHeight - d.v * 180;
    const nearest = ORDER.reduce((best, s) => (Math.abs(heights(s) - projected) < Math.abs(heights(best) - projected) ? s : best), 'peek' as Snap);
    goTo(nearest);
  }

  function onHandleKey(e: KeyboardEvent) {
    const i = ORDER.indexOf(snap);
    if (e.key === 'ArrowUp' && i < ORDER.length - 1) goTo(ORDER[i + 1]!);
    else if (e.key === 'ArrowDown' && i > 0) goTo(ORDER[i - 1]!);
    else return;
    e.preventDefault();
  }

  const mobileStyle: CSSProperties | undefined = isLg || !size.container ? undefined : { height: heights(snap) };
  const rootStyle = {
    '--map-inset-bottom': isLg ? '0px' : `${heights('peek')}px`,
    '--map-inset-left': isLg ? `${PANEL_INSET_LG}px` : '0px',
  } as CSSProperties;

  return (
    <div ref={rootRef} className="relative isolate min-h-0 flex-1 overflow-hidden" style={rootStyle}>
      <div className="absolute inset-0">{map}</div>
      {overlay}

      <section
        ref={sheetRef}
        aria-label={label}
        style={mobileStyle}
        className={cn(
          'absolute z-(--z-sheet) flex flex-col',
          // Bottom sheet
          'inset-x-0 bottom-0 h-[38%] rounded-t-3xl bg-surface pb-(--safe-bottom) shadow-xl ring-1 ring-border',
          'transition-[height] duration-(--duration-slow) ease-out data-dragging:transition-none',
          // Floating glass panel
          'lg:inset-y-4 lg:left-4 lg:right-auto lg:h-auto! lg:w-[400px] lg:overflow-y-auto lg:overscroll-contain lg:rounded-3xl lg:bg-glass lg:pb-0 lg:backdrop-blur-xl lg:[scrollbar-width:thin]',
        )}
      >
        <div
          className="shrink-0 touch-none lg:touch-auto"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <button
            type="button"
            data-sheet-handle
            aria-label={snap === 'full' ? 'Collapse panel' : 'Expand panel'}
            aria-expanded={snap !== 'peek'}
            onKeyDown={onHandleKey}
            onClick={(e) => {
              // Pointer taps are handled in onPointerUp; this covers Enter / Space.
              if (e.detail === 0) goTo(ORDER[(ORDER.indexOf(snap) + 1) % ORDER.length]!);
            }}
            className="flex w-full cursor-grab items-center justify-center rounded-t-3xl active:cursor-grabbing lg:hidden"
            style={{ height: HANDLE_H }}
          >
            <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-border-strong" />
          </button>
          <div ref={peekRef} className="px-4 pb-2 lg:pt-4">
            {peek}
          </div>
        </div>

        {children && (
          <div
            inert={!isLg && snap === 'peek'}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-4 pt-1 lg:flex-none lg:overflow-visible"
          >
            {children}
          </div>
        )}
      </section>
    </div>
  );
}
