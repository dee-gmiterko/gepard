export const MIN_SCALE = 0.25;
export const MAX_SCALE = 8;
const STEP = 1.25;

export interface View {
  scale: number;
  x: number;
  y: number;
}

export const initialView: View = { scale: 1, x: 0, y: 0 };

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function zoomView(view: View, direction: 1 | -1): View {
  const scale = clampScale(direction === 1 ? view.scale * STEP : view.scale / STEP);
  const ratio = scale / view.scale;
  return { scale, x: view.x * ratio, y: view.y * ratio };
}

export function panView(view: View, dx: number, dy: number): View {
  return { ...view, x: view.x + dx, y: view.y + dy };
}
