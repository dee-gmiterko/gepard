export function compileHiddenPatterns(patterns: readonly string[]): RegExp[] {
  const compiled: RegExp[] = [];
  for (const pattern of patterns) {
    if (pattern.trim() === '') continue;
    try {
      compiled.push(new RegExp(pattern));
    } catch {
      continue;
    }
  }
  return compiled;
}

export function mergeHiddenPatterns(
  globalPatterns: readonly string[],
  projectPatterns: readonly string[],
): string[] {
  return [...new Set([...globalPatterns, ...projectPatterns])];
}

export function filterHiddenPaths<T>(
  items: readonly T[],
  patterns: readonly RegExp[],
  pathOf: (item: T) => string,
): T[] {
  if (patterns.length === 0) return [...items];
  return items.filter((item) => {
    const path = pathOf(item);
    return !patterns.some((pattern) => pattern.test(path));
  });
}
