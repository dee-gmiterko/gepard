import { useCallback, useLayoutEffect, useMemo } from 'react';
import type { Extension } from '@codemirror/state';
import { closeHoverTooltips, type EditorView } from '@codemirror/view';
import { SymbolPortals } from '../../../codeEditor/SymbolPortals';
import { useUiDispatch } from '../../../state/UiContext';
import { useDefinitionLookup } from '../../../queries/search';
import { useTree } from '../../../queries/files';
import { GotoTarget, gotoDefinition } from '../../../codeEditor/gotoDefinition';
import { resolveImportPath } from '../../../helpers/importPath';

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

export function useGotoDefinition(
  path: string,
  portals: SymbolPortals,
  fileLineOf: (docLine: number) => number | null = (docLine) => docLine,
): Extension {
  const dispatch = useUiDispatch();
  const { data: tree } = useTree();
  const files = useMemo(() => new Set(tree ?? []), [tree]);
  const target = useMemo(() => new GotoTarget(), []);
  useLayoutEffect(() => {
    const open = (view: EditorView, to: string, line: number | null): void => {
      view.dispatch({ effects: closeHoverTooltips });
      dispatch({ type: 'file/open', path: to, line });
    };
    target.set({
      resolveImport: (spec) => resolveImportPath(path, spec, files),
      openFile: (to, view) => open(view, to, null),
      openSymbol: (symbol, view) => {
        const line = fileLineOf(symbol.line);
        if (line === null) return;
        void portals.resolve({ ...symbol, line }).then((definitions) => {
          const def = definitions.find((d) => !d.external);
          if (def) open(view, def.location.path, def.location.range.start.line);
        });
      },
    });
  }, [target, dispatch, path, files, portals, fileLineOf]);
  return useMemo(() => gotoDefinition(target), [target]);
}
