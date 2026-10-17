import { useEffect } from 'react';
import { useUiDispatch, useUiStore } from '../../state/UiContext';
import { describeTarget } from '../../keyboard/keyTargets';
import { isTextEntryTarget } from '../../helpers/eventTarget';
import { hasTextMenuContent } from '../../helpers/contextMenu';

function isEditable(target: EventTarget | null): boolean {
  const descriptor = describeTarget(target);
  return descriptor !== null && descriptor.tagName !== 'SELECT' && isTextEntryTarget(descriptor);
}

// Selected text inside an input or textarea is not reported by window.getSelection().
function hasSelection(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
    return target.selectionStart !== target.selectionEnd;
  return (window.getSelection()?.toString() ?? '') !== '';
}

export function useContextMenuTrigger(): void {
  const store = useUiStore();
  const dispatch = useUiDispatch();

  useEffect(() => {
    function onContextMenu(e: MouseEvent): void {
      const menu = {
        kind: 'text',
        x: e.clientX,
        y: e.clientY,
        editable: isEditable(e.target),
        hasSelection: hasSelection(e.target),
        target: store.getState().contextMenuLineTarget,
      } as const;
      if (!hasTextMenuContent(menu)) return;
      e.preventDefault();
      dispatch({ type: 'contextMenu/open', menu });
    }
    document.addEventListener('contextmenu', onContextMenu);
    return () => document.removeEventListener('contextmenu', onContextMenu);
  }, [store, dispatch]);
}
