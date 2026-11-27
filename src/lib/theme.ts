export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'dt-theme';

/** Browser chrome colour per theme — mirrors --bg in globals.css. */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: '#f9fafc',
  dark: '#0c0e14',
};

export function isThemePreference(v: unknown): v is ThemePreference {
  return v === 'system' || v === 'light' || v === 'dark';
}

/**
 * Runs inline in <head> before first paint: resolves the stored preference
 * (or the OS setting) and sets data-theme on <html>, so there is no flash of
 * the wrong theme. Static string, no user data.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');if(p!=='light'&&p!=='dark')p=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=p;}catch(e){document.documentElement.dataset.theme='light';}})();`;
