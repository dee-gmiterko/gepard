import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useResizeHandle } from '../../src/hooks/useResizeHandle';

function drag(options: { getMax?: () => number; start: number; dx: number }): number[] {
  const changes: number[] = [];
  const { result } = renderHook(() =>
    useResizeHandle({
      min: 200,
      max: 600,
      getMax: options.getMax,
      sign: 1,
      getValue: () => options.start,
      onChange: (v) => changes.push(v),
      onCommit: () => undefined,
    }),
  );
  const el = document.createElement('div');
  el.setPointerCapture = vi.fn();
  result.current.onPointerDown({
    preventDefault: () => undefined,
    currentTarget: el,
    pointerId: 1,
    clientX: 0,
  } as unknown as ReactPointerEvent<HTMLElement>);
  const move = new Event('pointermove') as Event & { clientX: number };
  move.clientX = options.dx;
  el.dispatchEvent(move);
  return changes;
}

describe('useResizeHandle', () => {
  it('clamps to the static limits', () => {
    expect(drag({ start: 300, dx: 1000 })).toEqual([600]);
    expect(drag({ start: 300, dx: -1000 })).toEqual([200]);
  });

  it('clamps to the available space', () => {
    expect(drag({ start: 300, dx: 1000, getMax: () => 400 })).toEqual([400]);
  });

  it('starts from the visible width when the saved width does not fit', () => {
    expect(drag({ start: 600, dx: -50, getMax: () => 300 })).toEqual([250]);
  });

  it('lets a tight space override the minimum', () => {
    expect(drag({ start: 300, dx: -1000, getMax: () => 150 })).toEqual([150]);
  });

  it('commits the latest width when a touch gesture is cancelled', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useResizeHandle({
        min: 200,
        max: 600,
        sign: 1,
        getValue: () => 300,
        onChange: () => undefined,
        onCommit,
      }),
    );
    const el = document.createElement('div');
    const setPointerCapture = vi.fn();
    el.setPointerCapture = setPointerCapture;
    result.current.onPointerDown({
      preventDefault: () => undefined,
      currentTarget: el,
      pointerId: 7,
      clientX: 0,
    } as unknown as ReactPointerEvent<HTMLElement>);
    const move = new Event('pointermove') as Event & { clientX: number };
    move.clientX = 50;
    el.dispatchEvent(move);
    el.dispatchEvent(new Event('pointercancel'));
    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(onCommit).toHaveBeenCalledWith(350);
  });
});
