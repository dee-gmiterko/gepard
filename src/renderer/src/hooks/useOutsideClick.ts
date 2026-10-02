import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

export function useOutsideClick(ref: RefObject<HTMLElement | null>, onOutside: () => void): void {
  const onOutsideRef = useRef(onOutside);
  useLayoutEffect(() => {
    onOutsideRef.current = onOutside;
  });

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent): void {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target))
        onOutsideRef.current();
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [ref]);
}
