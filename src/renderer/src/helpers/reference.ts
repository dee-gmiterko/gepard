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
}

export function initialReferenceChoices(references: CommentReference[]): ReferenceChoices {
  return {
    symbolOpen: references.some((r) => r.kind === 'symbol'),
    symbols: references.filter((r) => r.kind === 'symbol'),
    exactOpen: references.some((r) => r.kind === 'exact'),
    exactScope: 'all',
    patternsDefaultOpen: references.some((r) => r.kind === 'pattern'),
    patterns: {},
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
  return choices.patterns[id]?.open ?? choices.patternsDefaultOpen;
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
