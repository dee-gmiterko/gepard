import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

export function useOutsideClick(ref: RefObject<HTMLElement | null>, onOutside: () => void): void {
  const onOutsideRef = useRef(onOutside);
  useLayoutEffect(() => {
    onOutsideRef.current = onOutside;
  });

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutsideRef.current();
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [ref]);
}
