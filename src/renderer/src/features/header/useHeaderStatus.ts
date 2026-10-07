import { useEffect } from 'react';
import { useUiDispatch } from '../../state/UiContext';
import { useHeaderStatusState } from '../../state/hooks';
import type { HeaderStatus } from '../../state/reducer';

const HEADER_STATUS_MS = 3000;

export function useHeaderStatus(): HeaderStatus | null {
  const dispatch = useUiDispatch();
  const headerStatus = useHeaderStatusState();
  const headerStatusId = headerStatus?.id;

  useEffect(() => {
    if (headerStatusId === undefined) return;
    const timer = setTimeout(
      () => dispatch({ type: 'headerStatus/clear', id: headerStatusId }),
      HEADER_STATUS_MS,
    );
    return () => clearTimeout(timer);
  }, [headerStatusId, dispatch]);

  return headerStatus;
}
