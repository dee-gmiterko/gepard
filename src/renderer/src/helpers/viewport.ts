export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// When the box does not fit, the top-left edge wins.
export function clampToBounds(at: Point, size: Size, bounds: Bounds, padding: number): Point {
  const minX = bounds.left + padding;
  const minY = bounds.top + padding;
  const maxX = Math.max(minX, bounds.right - padding - size.width);
  const maxY = Math.max(minY, bounds.bottom - padding - size.height);
  return {
    x: Math.min(Math.max(at.x, minX), maxX),
    y: Math.min(Math.max(at.y, minY), maxY),
  };
}

export function clampToViewport(at: Point, size: Size, viewport: Size, padding: number): Point {
  return clampToBounds(
    at,
    size,
    { left: 0, top: 0, right: viewport.width, bottom: viewport.height },
    padding,
  );
}
