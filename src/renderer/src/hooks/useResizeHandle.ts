import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';

interface UseResizeHandleOptions {
  min: number;
  max: number;
  sign: 1 | -1;
  getValue: () => number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}

export function useResizeHandle({
  min,
  max,
  sign,
  getValue,
  onChange,
  onCommit,
}: UseResizeHandleOptions): { onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void } {
  const cleanupRef = useRef<(() => void) | null>(null);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      e.preventDefault();
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startValue = getValue();
      let latest = startValue;

      const move = (ev: globalThis.PointerEvent): void => {
        const delta = (ev.clientX - startX) * sign;
        latest = Math.min(max, Math.max(min, startValue + delta));
        onChange(latest);
      };
      // Browsers fire pointercancel instead of pointerup when they interrupt a gesture.
      const end = (): void => {
        cleanupRef.current?.();
        onCommit(latest);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      cleanupRef.current = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', end);
        el.removeEventListener('pointercancel', end);
        cleanupRef.current = null;
      };
    },
    [min, max, sign, getValue, onChange, onCommit],
  );

  return { onPointerDown };
}
