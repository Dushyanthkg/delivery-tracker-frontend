import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mapTheme } from '@/components/map/theme';
import { THEME_COLORS } from '@/lib/theme';

/**
 * Guards the design tokens in globals.css:
 *  - map colours (hex, in components/map/theme.ts) match their oklch tokens
 *  - text/background pairs meet WCAG 2.2 AA (4.5:1) in both themes
 */

const css = readFileSync(fileURLToPath(new URL('./globals.css', import.meta.url)), 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`missing ${selector}`);
  const body = css.slice(start, css.indexOf('\n}', start));
  return Object.fromEntries([...body.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)].map((m) => [m[1]!, m[2]!.trim()]));
}

const light = block(':root');
const dark = { ...light, ...block(':root[data-theme="dark"]') };

type RGB = [number, number, number];

function resolve(vars: Record<string, string>, name: string): RGB {
  let v = vars[name];
  for (let i = 0; v && v.startsWith('var(') && i < 5; i++) v = vars[v.slice(6, -1)];
  const m = v?.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!m) throw new Error(`--${name} is not a plain oklch() colour: ${v}`);
  return oklchToSrgb(Number(m[1]), Number(m[2]), Number(m[3]));
}

function oklchToSrgb(L: number, C: number, H: number): RGB {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return linear.map((c) => {
    const x = Math.min(1, Math.max(0, c));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  }) as RGB;
}

const hexToRgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as RGB;
const WHITE: RGB = [1, 1, 1];

function luminance(rgb: RGB): number {
  const [r, g, b] = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as RGB;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: RGB, b: RGB): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
/** Largest per-channel difference, in 0–255 steps. */
const distance = (a: RGB, b: RGB) => Math.max(...a.map((c, i) => Math.abs(c - b[i]!) * 255));

describe('design tokens', () => {
  it('map colours mirror their CSS tokens', () => {
    const pairs: Array<[string, string]> = [
      [mapTheme.rider.color, 'brand'],
      [mapTheme.route.color, 'brand'],
      [mapTheme.places.pickup.color, 'pickup'],
      [mapTheme.places.dropoff.color, 'dropoff'],
      [mapTheme.places.order.color, 'status-pending'],
      [mapTheme.places.draft.color, 'status-cancelled'],
      [THEME_COLORS.light, 'bg'],
    ];
    for (const [hex, token] of pairs) expect(distance(hexToRgb(hex), resolve(light, token)), `${hex} vs --${token}`).toBeLessThanOrEqual(2);
    expect(distance(hexToRgb(THEME_COLORS.dark), resolve(dark, 'bg'))).toBeLessThanOrEqual(2);
  });

  const textPairs: Array<[fg: string, bg: string]> = [
    ['text', 'bg'],
    ['text-muted', 'surface'],
    ['text-muted', 'surface-muted'],
    ['text-subtle', 'surface'],
    ['brand-fg', 'brand'],
    ['brand-text', 'surface'],
    ['brand-text', 'brand-soft'],
    ['success-text', 'success-soft'],
    ['warning-text', 'warning-soft'],
    ['warning-fg', 'warning'],
    ['danger-text', 'danger-soft'],
    ['info-text', 'info-soft'],
    ...(['pending', 'assigned', 'picked-up', 'in-transit', 'delivered', 'cancelled'] as const).map(
      (s) => [`status-${s}-text`, `status-${s}-soft`] as [string, string],
    ),
  ];

  for (const [name, vars] of [['light', light], ['dark', dark]] as const) {
    it(`text pairs meet WCAG AA in the ${name} theme`, () => {
      for (const [fg, bg] of textPairs) {
        expect(contrast(resolve(vars, fg), resolve(vars, bg)), `--${fg} on --${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      // White labels on solid buttons.
      for (const solid of ['success', 'danger']) expect(contrast(WHITE, resolve(vars, solid)), `white on --${solid}`).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('white glyphs stay readable on map pins and rider avatars', () => {
    for (const hex of [mapTheme.places.pickup.color, mapTheme.places.dropoff.color, ...mapTheme.rider.palette]) {
      expect(contrast(WHITE, hexToRgb(hex)), hex).toBeGreaterThanOrEqual(4.5);
    }
  });
});
