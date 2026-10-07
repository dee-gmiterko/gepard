import { z } from 'zod';
import { withoutExactMatches, type LinePattern } from './linePattern';
import type { CommentReference, GroupedResult, ReferenceKind, SearchScope } from '@gepard/common';

export function sameRef(a: CommentReference, b: CommentReference): boolean {
  return a.kind === b.kind && a.path === b.path && a.line === b.line;
}

export function toggleRefIn(
  references: CommentReference[],
  ref: CommentReference,
): CommentReference[] {
  return references.some((r) => sameRef(r, ref))
    ? references.filter((r) => !sameRef(r, ref))
    : [...references, ref];
}

export interface ReferenceChoices {
  symbolOpen: boolean;
  symbols: CommentReference[];
  exactOpen: boolean;
  exactScope: SearchScope;
  patternsDefaultOpen: boolean;
  patterns: Record<string, { open?: boolean; scope?: SearchScope }>;
  savedExact: CommentReference[];
  savedPatterns: CommentReference[];
}

export function initialReferenceChoices(references: CommentReference[]): ReferenceChoices {
  return {
    symbolOpen: references.some((r) => r.kind === 'symbol'),
    symbols: references.filter((r) => r.kind === 'symbol'),
    exactOpen: references.some((r) => r.kind === 'exact'),
    exactScope: 'all',
    patternsDefaultOpen: false,
    patterns: {},
    savedExact: references.filter((r) => r.kind === 'exact'),
    savedPatterns: references.filter((r) => r.kind === 'pattern'),
  };
}

export function referencesFromResult(
  data: GroupedResult | undefined,
  kind: Exclude<ReferenceKind, 'symbol'>,
): CommentReference[] {
  if (!data) return [];
  return data.files.flatMap((f) => f.matches.map((m) => ({ path: f.path, line: m.line, kind })));
}

export function isPatternOpen(choices: ReferenceChoices, id: string): boolean {
  return choices.patterns[id]?.open ?? (id in choices.patterns || choices.patternsDefaultOpen);
}

export function patternScopeOf(choices: ReferenceChoices, id: string): SearchScope {
  return choices.patterns[id]?.scope ?? 'all';
}

export function uniqueRefs(references: CommentReference[]): CommentReference[] {
  return references.reduce<CommentReference[]>(
    (acc, r) => (acc.some((x) => sameRef(x, r)) ? acc : [...acc, r]),
    [],
  );
}

export const ExactDisabledReason = z.enum(['blankLine', 'noOtherMatch']);
export type ExactDisabledReason = z.infer<typeof ExactDisabledReason>;

export interface PatternView {
  id: string;
  display: string;
  data: GroupedResult | undefined;
  fetching: boolean;
}

export interface QueryView {
  data?: GroupedResult;
  isFetching?: boolean;
}

interface Origin {
  path: string;
  line: number;
}

interface DefinitionLike {
  external?: boolean;
  location: { path: string; range: { start: { line: number } } };
}

export function lineTextOf(
  content: { kind: string; text?: string } | undefined,
  line: number,
): string | null {
  if (!content || content.kind !== 'text') return null;
  return content.text?.split('\n')[line - 1] ?? null;
}

export function isSymbolDisabled(
  definitions: DefinitionLike[],
  origin: Origin | null,
  settled: boolean,
): boolean {
  return (
    settled &&
    !definitions.some(
      (d) =>
        !d.external &&
        !(d.location.path === origin?.path && d.location.range.start.line === origin.line),
    )
  );
}

export function exactDisabledReason(
  exactText: string,
  anywhere: GroupedResult | undefined,
): ExactDisabledReason | null {
  if (!exactText) return 'blankLine';
  return anywhere?.files.length === 0 ? 'noOtherMatch' : null;
}

export function targetedPatternsOf(
  patterns: LinePattern[],
  choices: ReferenceChoices,
): LinePattern[] {
  return patterns.filter(
    (p) => isPatternOpen(choices, p.id) && patternScopeOf(choices, p.id) === 'targeted',
  );
}

export interface DerivePatternViewsInput {
  patterns: LinePattern[];
  choices: ReferenceChoices;
  lineText: string;
  origin: Origin;
  anywhere: (QueryView | undefined)[];
  targeted: (QueryView | undefined)[];
}

export function derivePatternViews(input: DerivePatternViewsInput): {
  views: PatternView[];
  references: CommentReference[];
} {
  const { patterns, choices, lineText, origin, anywhere, targeted } = input;
  const targetedPatterns = targetedPatternsOf(patterns, choices);
  const views: PatternView[] = [];
  const refs: CommentReference[] = [];
  patterns.forEach((pattern, i) => {
    const all = anywhere[i]?.data;
    if (!all || withoutExactMatches(all, lineText, origin).files.length === 0) return;
    const open = isPatternOpen(choices, pattern.id);
    const scoped = patternScopeOf(choices, pattern.id) === 'targeted';
    const query = scoped ? targeted[targetedPatterns.indexOf(pattern)] : anywhere[i];
    const raw = open ? query?.data : undefined;
    const data = raw && withoutExactMatches(raw, lineText, origin);
    views.push({
      id: pattern.id,
      display: pattern.display,
      data,
      fetching: open && Boolean(query?.isFetching),
    });
    refs.push(...referencesFromResult(data, 'pattern'));
  });
  return { views, references: uniqueRefs(refs) };
}

export function combineReferences(
  choices: ReferenceChoices,
  exactData: GroupedResult | undefined,
  patternReferences: CommentReference[],
): CommentReference[] {
  const exact = !choices.exactOpen
    ? []
    : exactData
      ? referencesFromResult(exactData, 'exact')
      : choices.savedExact;
  const untouched = Object.keys(choices.patterns).length === 0;
  const patterns =
    patternReferences.length === 0 && untouched ? choices.savedPatterns : patternReferences;
  return [...choices.symbols, ...exact, ...patterns];
}
