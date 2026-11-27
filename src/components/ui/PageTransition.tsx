import { ViewTransition, type ReactNode } from 'react';

const DIRECTIONAL = { 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'none' };

/**
 * Slides page content left/right on links tagged with transitionTypes
 * ['nav-forward'] / ['nav-back']; everything else (browser back, refreshes,
 * Suspense reveals) swaps without animation. Put it in page.tsx, not a layout —
 * layouts persist, so enter/exit never fire there. CSS lives in globals.css.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={DIRECTIONAL} exit={DIRECTIONAL} default="none">
      {children}
    </ViewTransition>
  );
}
