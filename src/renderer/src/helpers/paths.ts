export function foldersOf(paths: readonly string[]): string[] {
  const set = new Set<string>();
  for (const path of paths) {
    const parts = path.split('/');
    parts.pop();
    let acc = '';
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      set.add(acc);
    }
  }
  return [...set].sort();
}
