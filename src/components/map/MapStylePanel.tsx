'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Layers, SunMoon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useEffectiveMapStyle, useMapPrefsStore, type MapLayerId } from '@/store/useMapPrefsStore';
import { mapTheme } from './theme';

const LAYER_LABELS: Record<MapLayerId, string> = {
  riders: 'Riders',
  route: 'Route',
  places: 'Pins',
};

const pill =
  'inline-flex h-9 items-center gap-1.5 rounded-full bg-glass px-3.5 text-xs font-semibold text-text shadow-md ring-1 ring-inset ring-border backdrop-blur-md transition-[background-color,transform] duration-(--duration-fast) hover:bg-surface active:scale-95 after:absolute after:-inset-1 relative';

/**
 * On-map control (bottom-right, above the attribution and clear of any bottom
 * sheet): pick a base style and show/hide layers. Until the viewer picks a
 * style the map follows the app theme ("Auto").
 */
export function MapStylePanel({ availableLayers, leading }: { availableLayers: MapLayerId[]; /** Extra buttons shown before 3D / Map. */ leading?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const styleId = useEffectiveMapStyle();
  const styleChosen = useMapPrefsStore((s) => s.styleChosen);
  const layers = useMapPrefsStore((s) => s.layers);
  const setStyle = useMapPrefsStore((s) => s.setStyle);
  const resetStyle = useMapPrefsStore((s) => s.resetStyle);
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
    <div
      ref={rootRef}
      className="absolute bottom-[calc(var(--map-inset-bottom,0px)+1.75rem)] right-3 z-(--z-map-overlay) flex flex-col-reverse items-end transition-[bottom] duration-(--duration-slow) ease-out"
    >
      <div className="flex items-center gap-2">
        {leading}
        <button
          type="button"
          aria-pressed={view3d}
          title={view3d ? 'Switch to flat 2D map' : 'Tilted 3D view with buildings (right-drag or Ctrl+drag to rotate/tilt)'}
          onClick={() => setView3d(!view3d)}
          className={cn(pill, view3d && 'bg-brand text-brand-fg ring-brand hover:bg-brand-hover')}
        >
          3D
        </button>
        <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)} className={pill}>
          <Layers aria-hidden="true" className="size-4" />
          Map
        </button>
      </div>

      {open && (
        <div
          id={panelId}
          className="mb-2 w-64 max-w-[calc(100vw-2rem)] origin-bottom-right animate-pop-in rounded-2xl bg-surface-raised p-3 text-sm text-text shadow-xl ring-1 ring-border"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-text-muted">Style</p>
            <button
              type="button"
              aria-pressed={!styleChosen}
              onClick={resetStyle}
              title="Light map in light mode, dark map in dark mode"
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold ring-1 ring-inset transition-colors',
                !styleChosen ? 'bg-brand-soft text-brand-text ring-brand/30' : 'text-text-muted ring-border hover:text-text',
              )}
            >
              <SunMoon aria-hidden="true" className="size-3.5" />
              Auto
            </button>
          </div>
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
                  className="flex flex-col items-center gap-1 rounded-lg text-[11px] font-medium"
                >
                  <span
                    className={cn(
                      'h-11 w-full rounded-lg ring-2 transition-shadow',
                      active ? 'ring-brand' : 'ring-border hover:ring-border-strong',
                    )}
                    style={{ background: s.swatch }}
                  />
                  <span className={active ? 'font-semibold text-brand-text' : 'text-text-muted'}>{s.label}</span>
                </button>
              );
            })}
          </div>

          {availableLayers.length > 0 && (
            <>
              <p className="mb-1.5 mt-3 text-xs font-semibold text-text-muted">Layers</p>
              <ul className="space-y-0.5">
                {availableLayers.map((id) => (
                  <li key={id}>
                    <label className="flex h-9 cursor-pointer items-center justify-between rounded-lg px-1.5 hover:bg-surface-muted">
                      <span>{LAYER_LABELS[id]}</span>
                      <input
                        type="checkbox"
                        className="size-4 accent-(--brand)"
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
