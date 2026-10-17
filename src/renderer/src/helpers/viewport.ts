export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export function clampToViewport(at: Point, size: Size, viewport: Size, padding: number): Point {
  const maxX = Math.max(padding, viewport.width - padding - size.width);
  const maxY = Math.max(padding, viewport.height - padding - size.height);
  return {
    x: Math.min(Math.max(at.x, padding), maxX),
    y: Math.min(Math.max(at.y, padding), maxY),
  };
}
