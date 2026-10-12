import type { Annotation, AnnotationLevel } from '@gepard/common';

const LEVEL_RANK: Record<AnnotationLevel, number> = { failure: 0, warning: 1, notice: 2 };

export function worstAnnotationByLine(
  annotations: readonly Annotation[],
  lineOf: (annotationLine: number) => number | null,
): Map<number, Annotation> {
  const worst = new Map<number, Annotation>();
  for (const a of annotations) {
    const line = lineOf(a.line);
    if (line === null) continue;
    const current = worst.get(line);
    if (!current || LEVEL_RANK[a.level] < LEVEL_RANK[current.level]) worst.set(line, a);
  }
  return worst;
}
