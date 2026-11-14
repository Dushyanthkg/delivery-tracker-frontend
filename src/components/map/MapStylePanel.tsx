'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useMapPrefsStore, type MapLayerId } from '@/store/useMapPrefsStore';
import { mapTheme } from './theme';

const LAYER_LABELS: Record<MapLayerId, string> = {
  riders: 'Riders',
  route: 'Route',
  places: 'Pins',
};

/**
 * On-map control (bottom-right, above the attribution): pick a base style and show/hide layers.
 * Only layers the current map actually has are listed (`availableLayers`).
 */
export function MapStylePanel({ availableLayers, leading }: { availableLayers: MapLayerId[]; /** Extra buttons shown before 3D / Map. */ leading?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const styleId = useMapPrefsStore((s) => s.styleId);
  const layers = useMapPrefsStore((s) => s.layers);
  const setStyle = useMapPrefsStore((s) => s.setStyle);
  const toggleLayer = useMapPrefsStore((s) => s.toggleLayer);
  const view3d = useMapPrefsStore((s) => s.view3d);
  const setView3d = useMapPrefsStore((s) => s.setView3d);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="absolute bottom-7 right-3 z-[1000] flex flex-col-reverse items-end">
      <div className="flex items-center gap-2">
        {leading}
        <button
          type="button"
          aria-pressed={view3d}
          title={view3d ? 'Switch to flat 2D map' : 'Tilted 3D view with buildings (right-drag or Ctrl+drag to rotate/tilt)'}
          onClick={() => setView3d(!view3d)}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-semibold shadow-md transition',
            view3d ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50',
          )}
        >
          3D
        </button>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-md transition hover:bg-slate-50"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m12 3 9 5-9 5-9-5 9-5Z" />
            <path d="m3 13 9 5 9-5" />
          </svg>
          Map
        </button>
      </div>

      {open && (
        <div id={panelId} className="mb-2 w-60 max-w-[calc(100vw-2rem)] rounded-xl bg-white p-3 text-sm text-slate-700 shadow-lg ring-1 ring-slate-900/5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Style</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Map style">
            {mapTheme.styles.map((s) => {
              const active = s.id === styleId;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setStyle(s.id)}
                  className="flex flex-col items-center gap-1 text-[11px] font-medium"
                >
                  <span
                    className={cn(
                      'h-10 w-full rounded-lg ring-2 transition',
                      active ? 'ring-indigo-600' : 'ring-slate-200 hover:ring-slate-300',
                    )}
                    style={{ background: s.swatch }}
                  />
                  <span className={active ? 'text-indigo-700' : undefined}>{s.label}</span>
                </button>
              );
            })}
          </div>

          {availableLayers.length > 0 && (
            <>
              <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Layers</p>
              <ul className="space-y-1">
                {availableLayers.map((id) => (
                  <li key={id}>
                    <label className="flex cursor-pointer items-center justify-between rounded-md px-1 py-1 hover:bg-slate-50">
                      <span>{LAYER_LABELS[id]}</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-indigo-600"
                        checked={layers[id]}
                        onChange={() => toggleLayer(id)}
                      />
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
