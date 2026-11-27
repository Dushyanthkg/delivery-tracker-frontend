'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useThemeStore } from '@/store/useThemeStore';
import type { ThemePreference } from '@/lib/theme';

const NEXT: Record<ThemePreference, ThemePreference> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<ThemePreference, string> = { system: 'System', light: 'Light', dark: 'Dark' };
const ICON = { system: <Monitor />, light: <Sun />, dark: <Moon /> };

/** One-tap theme cycle (System → Light → Dark). */
export function ThemeToggle({ variant = 'ghost' }: { variant?: 'ghost' | 'glass' | 'secondary' }) {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  return (
    <IconButton
      variant={variant}
      size="sm"
      icon={ICON[preference]}
      label={`Theme: ${LABEL[preference]} (switch to ${LABEL[NEXT[preference]]})`}
      onClick={() => setPreference(NEXT[preference])}
    />
  );
}

/** Explicit three-way picker (used in the account menu). */
export function ThemePicker() {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  return (
    <SegmentedControl
      aria-label="Colour theme"
      size="sm"
      className="w-full"
      value={preference}
      onChange={setPreference}
      options={(['light', 'dark', 'system'] as const).map((p) => ({
        value: p,
        label: (
          <>
            {ICON[p]}
            {LABEL[p]}
          </>
        ),
      }))}
    />
  );
}
