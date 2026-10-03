import { useMemo } from 'react';
import {
  useDefinitions,
  useLineSymbols,
  useSearch,
  useSearches,
  type SearchParams,
} from '../../queries/search';
import { useFileContent, useTargetedFiles } from '../../queries/files';
import {
  combineReferences,
  derivePatternViews,
  exactDisabledReason,
  isSymbolDisabled,
  lineTextOf,
  targetedPatternsOf,
  ExactDisabledReason,
  type PatternView,
  type ReferenceChoices,
} from '../../helpers/reference';
import { buildLinePatterns, type LinePattern } from '../../helpers/linePattern';
import type { LineSymbol } from './SymbolDefinitionSection';
import type { RefAnchor } from '../../helpers/anchor';
import type { CommentReference, GroupedResult, SearchScope } from '@gepard/common';

export { ExactDisabledReason, type PatternView };

export interface DerivedReferences {
  references: CommentReference[];
  symbols: LineSymbol[];
  symbolsLoading: boolean;
  symbolDisabled: boolean;
  exactDisabled: ExactDisabledReason | null;
  exactData: GroupedResult | undefined;
  exactFetching: boolean;
  patterns: PatternView[];
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

  const symbolPositions = useMemo(
    () => symbols.map((s) => ({ line: s.range.start.line, col: s.range.start.col })),
    [symbols],
  );
  const definitions = useDefinitions(
    refAnchor?.symbolsResolvable ? refAnchor.sha : '',
    refAnchor?.path ?? '',
    symbolPositions,
  );
  const symbolDisabled = isSymbolDisabled(
    definitions.definitions,
    refAnchor,
    !lineSymbols.isLoading && !lineSymbols.error && !definitions.pending,
  );

  const lineText = useMemo(
    () => (refAnchor ? lineTextOf(fileContent.data, refAnchor.line) : null),
    [fileContent.data, refAnchor],
  );

  const exactText = lineText?.trim() ?? '';
  function exactParams(scope: SearchScope): SearchParams | null {
    if (!refAnchor || !exactText) return null;
    return {
      scope,
      targetedPaths: scope === 'targeted' ? targetedPaths : [],
      kind: 'exactLine',
      text: exactText,
      // The search itself drops the origin line, so any hit is another line.
      origin: { path: refAnchor.path, line: refAnchor.line },
    };
  }
  const exactAnywhere = useSearch(refAnchor?.sha ?? '', exactParams('all'));
  const exactSearch = useSearch(
    refAnchor?.sha ?? '',
    choices.exactOpen ? exactParams(choices.exactScope) : null,
  );
  const exactDisabled = exactDisabledReason(exactText, exactAnywhere.data);

  const patterns = useMemo(() => buildLinePatterns(lineText ?? '', symbols), [lineText, symbols]);
  function patternParams(pattern: LinePattern, scope: SearchScope): SearchParams {
    return {
      scope,
      targetedPaths: scope === 'targeted' ? targetedPaths : [],
      kind: 'regex',
      text: pattern.regex,
      caseSensitive: true,
    };
  }
  const sha = refAnchor?.sha ?? '';
  const anywhere = useSearches(sha, refAnchor ? patterns.map((p) => patternParams(p, 'all')) : []);
  const targetedPatterns = targetedPatternsOf(patterns, choices);
  const targeted = useSearches(
    sha,
    refAnchor ? targetedPatterns.map((p) => patternParams(p, 'targeted')) : [],
  );

  const derived =
    refAnchor && lineText !== null
      ? derivePatternViews({
          patterns,
          choices,
          lineText,
          origin: refAnchor,
          anywhere,
          targeted,
        })
      : { views: [], references: [] };
  const references = combineReferences(choices, exactSearch.data, derived.references);

  return {
    references,
    symbols,
    symbolsLoading: lineSymbols.isLoading,
    symbolDisabled,
    exactDisabled,
    exactData: exactSearch.data,
    exactFetching: exactSearch.isFetching,
    patterns: derived.views,
  };
}
