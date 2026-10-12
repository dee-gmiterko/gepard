import { useMemo } from 'react';
import type { Annotation } from '@gepard/common';
import { useCheckoutHead } from '../../../state/hooks';
import { useCurrentHead } from '../../../queries/projects';
import { useFileAnnotations } from '../../../queries/checks';

export function useViewerAnnotations(path: string, shownRevision = true): readonly Annotation[] {
  const checkoutHead = useCheckoutHead();
  const head = useCurrentHead();
  const { data } = useFileAnnotations(path);
  return useMemo(
    () => (shownRevision && checkoutHead?.head === head ? (data ?? []) : []),
    [shownRevision, checkoutHead, head, data],
  );
}
