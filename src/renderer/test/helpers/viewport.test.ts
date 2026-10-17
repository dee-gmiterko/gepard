import { describe, expect, it } from 'vitest';
import { clampToViewport } from '../../src/helpers/viewport';

const viewport = { width: 800, height: 600 };
const size = { width: 200, height: 100 };

describe('clampToViewport', () => {
  it('keeps a position that fits', () => {
    expect(clampToViewport({ x: 10, y: 20 }, size, viewport, 4)).toEqual({ x: 10, y: 20 });
  });

  it('shifts a menu overflowing the right and bottom edges back inside', () => {
    expect(clampToViewport({ x: 790, y: 590 }, size, viewport, 4)).toEqual({ x: 596, y: 496 });
  });

  it('keeps the padding from the top and left edges', () => {
    expect(clampToViewport({ x: -5, y: 0 }, size, viewport, 4)).toEqual({ x: 4, y: 4 });
  });

  it('pins to the padding when the menu is larger than the viewport', () => {
    expect(clampToViewport({ x: 50, y: 50 }, { width: 900, height: 700 }, viewport, 4)).toEqual({
      x: 4,
      y: 4,
    });
  });
});
