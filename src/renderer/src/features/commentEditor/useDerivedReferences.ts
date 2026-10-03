import { z } from 'zod';
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
  isPatternOpen,
  patternScopeOf,
  referencesFromResult,
  uniqueRefs,
  type ReferenceChoices,
} from '../../helpers/reference';
import {
  buildLinePatterns,
  withoutExactMatches,
  type LinePattern,
} from '../../helpers/linePattern';
import type { LineSymbol } from './SymbolDefinitionSection';
import type { RefAnchor } from '../../helpers/anchor';
import type { CommentReference, GroupedResult, SearchScope } from '@gepard/common';

export const ExactDisabledReason = z.enum(['blankLine', 'noOtherMatch']);
export type ExactDisabledReason = z.infer<typeof ExactDisabledReason>;

export interface PatternView {
  id: string;
  display: string;
  data: GroupedResult | undefined;
  fetching: boolean;
}

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
  const symbolDisabled =
    !lineSymbols.isLoading &&
    !lineSymbols.error &&
    !definitions.pending &&
    !definitions.definitions.some(
      (d) =>
        !d.external &&
        !(d.location.path === refAnchor?.path && d.location.range.start.line === refAnchor.line),
    );

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
  const targetedPatterns = patterns.filter(
    (p) => isPatternOpen(choices, p.id) && patternScopeOf(choices, p.id) === 'targeted',
  );
  const targeted = useSearches(
    sha,
    refAnchor ? targetedPatterns.map((p) => patternParams(p, 'targeted')) : [],
  );

  const patternViews: PatternView[] = [];
  const patternRefs: CommentReference[] = [];
  if (refAnchor && lineText !== null) {
    patterns.forEach((pattern, i) => {
      const all = anywhere[i]?.data;
      if (!all || withoutExactMatches(all, lineText, refAnchor).files.length === 0) return;
      const open = isPatternOpen(choices, pattern.id);
      const scoped = patternScopeOf(choices, pattern.id) === 'targeted';
      const query = scoped ? targeted[targetedPatterns.indexOf(pattern)] : anywhere[i];
      const raw = open ? query?.data : undefined;
      const data = raw && withoutExactMatches(raw, lineText, refAnchor);
      patternViews.push({
        id: pattern.id,
        display: pattern.display,
        data,
        fetching: open && Boolean(query?.isFetching),
      });
      patternRefs.push(...referencesFromResult(data, 'pattern'));
    });
  }

  const references = [
    ...choices.symbols,
    ...referencesFromResult(choices.exactOpen ? exactSearch.data : undefined, 'exact'),
    ...uniqueRefs(patternRefs),
  ];

  return {
    references,
    symbols,
    symbolsLoading: lineSymbols.isLoading,
    symbolDisabled,
    exactDisabled,
    exactData: exactSearch.data,
    exactFetching: exactSearch.isFetching,
    patterns: patternViews,
  };
}
