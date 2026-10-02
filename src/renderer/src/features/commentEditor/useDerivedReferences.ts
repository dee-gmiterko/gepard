import { z } from 'zod';
import { useMemo } from 'react';
import { useDefinitions, useLineSymbols, useSearch, type SearchParams } from '../../queries/search';
import { useFileContent, useTargetedFiles } from '../../queries/files';
import { referencesFromResult, type ReferenceChoices } from '../../helpers/reference';
import type { LineSymbol } from './SymbolDefinitionSection';
import type { RefAnchor } from '../../helpers/anchor';
import type { CommentReference, GroupedResult, SearchScope } from '@gepard/common';

export const ExactDisabledReason = z.enum(['blankLine', 'noOtherMatch']);
export type ExactDisabledReason = z.infer<typeof ExactDisabledReason>;

export interface DerivedReferences {
  references: CommentReference[];
  symbols: LineSymbol[];
  symbolsLoading: boolean;
  symbolDisabled: boolean;
  exactDisabled: ExactDisabledReason | null;
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

  const symbolPositions = useMemo(
    () => symbols.map((s) => ({ line: s.range.start.line, col: s.range.start.col })),
    [symbols],
  );
  const definitions = useDefinitions(
    refAnchor?.symbolsResolvable ? refAnchor.sha : '',
    refAnchor?.path ?? '',
    symbolPositions,
  );
  const symbolDisabled =
    !lineSymbols.isLoading &&
    !lineSymbols.error &&
    !definitions.pending &&
    !definitions.definitions.some(
      (d) =>
        !d.external &&
        !(d.location.path === refAnchor?.path && d.location.range.start.line === refAnchor.line),
    );

  const effectivePatternSymbol = choices.patternSymbol || symbols[0]?.name || '';

  const lineText = useMemo(() => {
    if (!refAnchor) return null;
    const c = fileContent.data;
    if (!c || c.kind !== 'text') return null;
    return c.text.split('\n')[refAnchor.line - 1] ?? null;
  }, [fileContent.data, refAnchor]);

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
  const exactDisabled: ExactDisabledReason | null = !exactText
    ? 'blankLine'
    : exactAnywhere.data?.files.length === 0
      ? 'noOtherMatch'
      : null;

  const patternAnywhere = useSearch(
    refAnchor?.sha ?? '',
    refAnchor && effectivePatternSymbol
      ? {
          scope: 'all',
          targetedPaths: [],
          kind: 'pattern',
          text: effectivePatternSymbol,
          word: true,
        }
      : null,
  );
  const patternDisabled =
    symbols.length === 0 ||
    (!patternAnywhere.isFetching &&
      patternAnywhere.data !== undefined &&
      !patternAnywhere.data.files.some((f) =>
        f.matches.some((m) => f.path !== refAnchor?.path || m.line !== refAnchor.line),
      ));
  const patternParams: SearchParams | null =
    refAnchor && choices.patternOpen && !patternDisabled && effectivePatternSymbol
      ? {
          scope: choices.patternScope,
          targetedPaths: choices.patternScope === 'targeted' ? targetedPaths : [],
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
    symbolDisabled,
    exactDisabled,
    exactData: exactSearch.data,
    exactFetching: exactSearch.isFetching,
    patternDisabled,
    patternData: patternSearch.data,
    patternFetching: patternSearch.isFetching,
    effectivePatternSymbol,
  };
}
