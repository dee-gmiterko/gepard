export function nextTargetedFile(
  files: readonly string[],
  activePath: string | null,
  viewedPaths: ReadonlySet<string>,
  direction: 1 | -1,
): string | null {
  const n = files.length;
  if (n === 0) return null;
  const current = activePath === null ? -1 : files.indexOf(activePath);
  const start = current !== -1 ? current : direction === 1 ? -1 : n;
  for (let step = 1; step <= n; step++) {
    const i = (((start + direction * step) % n) + n) % n;
    if (i === current) return null;
    if (!viewedPaths.has(files[i])) return files[i];
  }
  return null;
}

export function firstFileToReview(
  files: readonly string[],
  viewedPaths: ReadonlySet<string>,
): string | null {
  return nextTargetedFile(files, null, viewedPaths, 1) ?? files[0] ?? null;
}
