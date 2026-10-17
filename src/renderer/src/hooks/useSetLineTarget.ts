import { useCallback } from 'react';
import type { ContextMenuLineTarget } from '@gepard/common';
import { useUiDispatch } from '../state/UiContext';
import { reportQueryError } from '../errors/report';
import { invoke } from '../ipc/client';

export function useSetLineTarget(): (target: ContextMenuLineTarget) => void {
  const dispatch = useUiDispatch();
  return useCallback(
    (target) => {
      if (window.gepard.host === 'browser') {
        dispatch({ type: 'contextMenu/setLineTarget', target });
        return;
      }
      invoke('contextMenu.setLineTarget', target).catch((error: unknown) =>
        reportQueryError('contextMenu.setLineTarget', error),
      );
    },
    [dispatch],
  );
}
