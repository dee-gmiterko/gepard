import { describe, expect, it } from 'vitest';
import { initialView, MAX_SCALE, MIN_SCALE, panView, zoomView } from '../../src/helpers/lightbox';

describe('lightbox view', () => {
  it('zooms in and out around the current offset', () => {
    const zoomed = zoomView({ scale: 1, x: 10, y: -20 }, 1);
    expect(zoomed.scale).toBe(1.25);
    expect(zoomed.x).toBeCloseTo(12.5);
    expect(zoomed.y).toBeCloseTo(-25);
    expect(zoomView(zoomed, -1).scale).toBeCloseTo(1);
  });

  it('clamps the scale', () => {
    let view = initialView;
    for (let i = 0; i < 50; i++) view = zoomView(view, 1);
    expect(view.scale).toBe(MAX_SCALE);
    for (let i = 0; i < 100; i++) view = zoomView(view, -1);
    expect(view.scale).toBe(MIN_SCALE);
  });

  it('pans by a delta', () => {
    expect(panView(initialView, 5, -3)).toEqual({ scale: 1, x: 5, y: -3 });
  });
});
