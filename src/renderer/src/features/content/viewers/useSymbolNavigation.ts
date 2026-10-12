import { useCallback, useLayoutEffect, useMemo } from 'react';
import { closeHoverTooltips, type EditorView } from '@codemirror/view';
import { SymbolPortals } from '../../../codeEditor/SymbolPortals';
import { useUiDispatch } from '../../../state/UiContext';
import { useDefinitionLookup } from '../../../queries/search';

export function useSymbolPortals(sha: string, path: string): SymbolPortals {
  const lookupDefinition = useDefinitionLookup(sha, path);
  const portals = useMemo(() => new SymbolPortals(), []);
  useLayoutEffect(() => {
    portals.setResolver((symbol) =>
      lookupDefinition({ line: symbol.line, col: symbol.col }).then(
        (result) => result.definitions,
        () => [],
      ),
    );
  }, [portals, lookupDefinition]);
  return portals;
}

export function useOpenLocation(view: EditorView | null): (path: string, line: number) => void {
  const dispatch = useUiDispatch();
  return useCallback(
    (path, line) => {
      view?.dispatch({ effects: closeHoverTooltips });
      dispatch({ type: 'file/open', path, line });
    },
    [view, dispatch],
  );
}
