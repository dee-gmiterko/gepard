import { useEffect, useRef } from 'react';

export function useQuickSearchAutoFocus(): React.RefObject<HTMLInputElement | null> {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}
