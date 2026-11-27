'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getBaseStyle, mapTheme, type MapStyleId } from '@/components/map/theme';
import { useThemeStore } from './useThemeStore';
import type { ResolvedTheme } from '@/lib/theme';

export type MapLayerId = 'riders' | 'route' | 'places';

interface MapPrefsState {
  styleId: MapStyleId;
  /** True once the viewer picked a style; until then the map follows the app theme. */
  styleChosen: boolean;
  layers: Record<MapLayerId, boolean>;
  /** Tilted MapLibre view with 3D buildings instead of the flat Leaflet map. */
  view3d: boolean;
  setStyle: (id: MapStyleId) => void;
  /** Go back to following the app theme (light → Brand, dark → Dark). */
  resetStyle: () => void;
  toggleLayer: (id: MapLayerId) => void;
  setView3d: (on: boolean) => void;
}

const DEFAULT_LAYERS: Record<MapLayerId, boolean> = { riders: true, route: true, places: true };

/** Per-viewer map preferences (base style, visible layers, 2D/3D), kept in this browser only. */
export const useMapPrefsStore = create<MapPrefsState>()(
  persist(
    (set) => ({
      styleId: mapTheme.defaultStyle,
      styleChosen: false,
      layers: DEFAULT_LAYERS,
      view3d: false,
      setStyle: (styleId) => set({ styleId, styleChosen: true }),
      resetStyle: () => set({ styleId: mapTheme.defaultStyle, styleChosen: false }),
      toggleLayer: (id) => set((s) => ({ layers: { ...s.layers, [id]: !s.layers[id] } })),
      setView3d: (view3d) => set({ view3d }),
    }),
    {
      name: 'dt-map-prefs',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ styleId, styleChosen, layers, view3d }) => ({ styleId, styleChosen, layers, view3d }),
      // Drop a stored style that no longer exists in the theme; fill in new layer keys.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Pick<MapPrefsState, 'styleId' | 'styleChosen' | 'layers' | 'view3d'>>;
        const styleId = getBaseStyle(p.styleId).id;
        return {
          ...current,
          styleId,
          // Saved before styleChosen existed: a non-default style must have been picked by hand.
          styleChosen: typeof p.styleChosen === 'boolean' ? p.styleChosen : styleId !== mapTheme.defaultStyle,
          layers: { ...DEFAULT_LAYERS, ...p.layers },
          view3d: p.view3d === true,
        };
      },
    },
  ),
);

/** The style to render: the viewer's pick, else the default for the current app theme. */
export function effectiveStyleId(styleId: MapStyleId, styleChosen: boolean, theme: ResolvedTheme): MapStyleId {
  if (styleChosen) return styleId;
  return theme === 'dark' ? mapTheme.defaultDarkStyle : mapTheme.defaultStyle;
}

export function useEffectiveMapStyle(): MapStyleId {
  const styleId = useMapPrefsStore((s) => s.styleId);
  const styleChosen = useMapPrefsStore((s) => s.styleChosen);
  const theme = useThemeStore((s) => s.resolved);
  return effectiveStyleId(styleId, styleChosen, theme);
}
