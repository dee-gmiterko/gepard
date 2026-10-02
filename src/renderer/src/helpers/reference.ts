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
  patternOpen: boolean;
  patternScope: SearchScope;
  patternSymbol: string;
}

export function initialReferenceChoices(references: CommentReference[]): ReferenceChoices {
  return {
    symbolOpen: references.some((r) => r.kind === 'symbol'),
    symbols: references.filter((r) => r.kind === 'symbol'),
    exactOpen: references.some((r) => r.kind === 'exact'),
    exactScope: 'all',
    patternOpen: references.some((r) => r.kind === 'pattern'),
    patternScope: 'all',
    patternSymbol: '',
  };
}

export function referencesFromResult(
  data: GroupedResult | undefined,
  kind: Exclude<ReferenceKind, 'symbol'>,
): CommentReference[] {
  if (!data) return [];
  return data.files.flatMap((f) => f.matches.map((m) => ({ path: f.path, line: m.line, kind })));
}
