'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getBaseStyle, mapTheme, type MapStyleId } from '@/components/map/theme';

export type MapLayerId = 'riders' | 'route' | 'places';

interface MapPrefsState {
  styleId: MapStyleId;
  layers: Record<MapLayerId, boolean>;
  /** Tilted MapLibre view with 3D buildings instead of the flat Leaflet map. */
  view3d: boolean;
  setStyle: (id: MapStyleId) => void;
  toggleLayer: (id: MapLayerId) => void;
  setView3d: (on: boolean) => void;
}

const DEFAULT_LAYERS: Record<MapLayerId, boolean> = { riders: true, route: true, places: true };

/** Per-viewer map preferences (base style, visible layers, 2D/3D), kept in this browser only. */
export const useMapPrefsStore = create<MapPrefsState>()(
  persist(
    (set) => ({
      styleId: mapTheme.defaultStyle,
      layers: DEFAULT_LAYERS,
      view3d: false,
      setStyle: (styleId) => set({ styleId }),
      toggleLayer: (id) => set((s) => ({ layers: { ...s.layers, [id]: !s.layers[id] } })),
      setView3d: (view3d) => set({ view3d }),
    }),
    {
      name: 'dt-map-prefs',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ styleId, layers, view3d }) => ({ styleId, layers, view3d }),
      // Drop a stored style that no longer exists in the theme; fill in new layer keys.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Pick<MapPrefsState, 'styleId' | 'layers' | 'view3d'>>;
        return {
          ...current,
          styleId: getBaseStyle(p.styleId).id,
          layers: { ...DEFAULT_LAYERS, ...p.layers },
          view3d: p.view3d === true,
        };
      },
    },
  ),
);
