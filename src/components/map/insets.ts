/**
 * Space covered by UI over the map (bottom sheet / floating panel), published by
 * MapScreen as CSS variables, so fitted content stays visible.
 */
export function mapInsets(el: HTMLElement): { left: number; bottom: number } {
  const cs = getComputedStyle(el);
  return {
    left: parseFloat(cs.getPropertyValue('--map-inset-left')) || 0,
    bottom: parseFloat(cs.getPropertyValue('--map-inset-bottom')) || 0,
  };
}
