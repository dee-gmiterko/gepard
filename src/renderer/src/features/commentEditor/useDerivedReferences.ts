import { useMemo } from 'react';
import { useLineSymbols, useSearch, type SearchParams } from '../../queries/search';
import { useFileContent, useTargetedFiles } from '../../queries/files';
import type { ReferenceChoices } from './referenceChoices';
import type { LineSymbol } from './SymbolDefinitionSection';
import type { RefAnchor } from './anchorLine';
import type { CommentReference } from '@gepard/common/ipc/schemas/comment';
import type { GroupedResult } from '@gepard/common/ipc/schemas/search';

function referencesFromResult(
  data: GroupedResult | undefined,
  kind: 'exact' | 'pattern',
): CommentReference[] {
  if (!data) return [];
  return data.files.flatMap((f) => f.matches.map((m) => ({ path: f.path, line: m.line, kind })));
}

export interface DerivedReferences {
  references: CommentReference[];
  symbols: LineSymbol[];
  symbolsLoading: boolean;
  symbolsError: Error | null;
  exactDisabled: boolean;
  exactData: GroupedResult | undefined;
  exactFetching: boolean;
  patternDisabled: boolean;
  patternData: GroupedResult | undefined;
  patternFetching: boolean;
  effectivePatternSymbol: string;
}

export function useDerivedReferences(
  choices: ReferenceChoices,
  refAnchor: RefAnchor | null,
): DerivedReferences {
  const targetedPaths = useTargetedFiles();

  const lineSymbols = useLineSymbols(
    refAnchor?.symbolsResolvable ? refAnchor.sha : '',
    refAnchor?.path ?? '',
    refAnchor?.line ?? 1,
  );
  const fileContent = useFileContent(refAnchor?.sha ?? '', refAnchor?.path ?? '');
  const symbols = useMemo(() => lineSymbols.data?.symbols ?? [], [lineSymbols.data]);

  const effectivePatternSymbol = choices.patternSymbol || symbols[0]?.name || '';

  const lineText = useMemo(() => {
    if (!refAnchor) return null;
    const c = fileContent.data;
    if (!c || c.kind !== 'text') return null;
    return c.text.split('\n')[refAnchor.line - 1] ?? null;
  }, [fileContent.data, refAnchor]);

  const exactDisabled = !lineText || !lineText.trim();
  const exactParams: SearchParams | null =
    refAnchor && choices.exactOpen && !exactDisabled
      ? {
          scope: choices.exactScope,
          targetedPaths,
          kind: 'exactLine',
          text: lineText!.trim(),
          origin: { path: refAnchor.path, line: refAnchor.line },
        }
      : null;
  const exactSearch = useSearch(refAnchor?.sha ?? '', exactParams);

  const patternDisabled = symbols.length === 0;
  const patternParams: SearchParams | null =
    refAnchor && choices.patternOpen && !patternDisabled && effectivePatternSymbol
      ? {
          scope: choices.patternScope,
          targetedPaths,
          kind: 'pattern',
          text: effectivePatternSymbol,
          word: true,
        }
      : null;
  const patternSearch = useSearch(refAnchor?.sha ?? '', patternParams);

  const references = useMemo(
    () => [
      ...choices.symbols,
      ...referencesFromResult(choices.exactOpen ? exactSearch.data : undefined, 'exact'),
      ...referencesFromResult(choices.patternOpen ? patternSearch.data : undefined, 'pattern'),
    ],
    [choices.symbols, choices.exactOpen, exactSearch.data, choices.patternOpen, patternSearch.data],
  );

  return {
    references,
    symbols,
    symbolsLoading: lineSymbols.isLoading,
    symbolsError: lineSymbols.error,
    exactDisabled,
    exactData: exactSearch.data,
    exactFetching: exactSearch.isFetching,
    patternDisabled,
    patternData: patternSearch.data,
    patternFetching: patternSearch.isFetching,
    effectivePatternSymbol,
  };
}
