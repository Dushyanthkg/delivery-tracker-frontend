'use client';

import { create } from 'zustand';
import { matchesMedia } from '@/hooks/useMediaQuery';
import { isThemePreference, THEME_COLORS, THEME_STORAGE_KEY, type ResolvedTheme, type ThemePreference } from '@/lib/theme';

interface ThemeState {
  /** What the viewer chose ('system' follows the OS). */
  preference: ThemePreference;
  /** What is actually applied right now. */
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
  /** Read the stored preference and the theme the inline script applied. */
  hydrate: () => void;
  /** Re-resolve after the OS theme changes. */
  syncSystem: () => void;
}

const systemTheme = (): ResolvedTheme => (matchesMedia('(prefers-color-scheme: dark)') ? 'dark' : 'light');

function apply(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = resolved;
  // Keep the browser / Android status bar in step with a manual override.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', THEME_COLORS[resolved]));
}

/**
 * App colour theme. Server render and first client render use the defaults;
 * <ThemeSync> hydrates from the DOM (already themed by the inline script) on mount.
 */
export const useThemeStore = create<ThemeState>()((set, get) => ({
  preference: 'system',
  resolved: 'light',

  setPreference: (preference) => {
    try {
      if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      /* storage blocked — still apply for this session */
    }
    const resolved = preference === 'system' ? systemTheme() : preference;
    apply(resolved);
    set({ preference, resolved });
  },

  hydrate: () => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const preference: ThemePreference = isThemePreference(stored) ? stored : 'system';
    const resolved = preference === 'system' ? systemTheme() : preference;
    apply(resolved);
    set({ preference, resolved });
  },

  syncSystem: () => {
    if (get().preference !== 'system') return;
    const resolved = systemTheme();
    apply(resolved);
    set({ resolved });
  },
}));
