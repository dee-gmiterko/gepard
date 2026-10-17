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

export function pathSeed(path: string): number {
  let fnv = 0x811c9dc5;
  for (let i = 0; i < path.length; i++) {
    fnv = Math.imul(fnv ^ path.charCodeAt(i), 0x01000193);
  }
  return fnv >>> 0;
}

function pickSeeded(pool: readonly string[], seed: number, direction: 1 | -1): string {
  const offset = seed % pool.length;
  return pool[direction === 1 ? offset : pool.length - 1 - offset];
}

export function nextRandomizedFile(
  files: readonly string[],
  activePath: string | null,
  viewedPaths: ReadonlySet<string>,
  direction: 1 | -1,
): string | null {
  if (activePath === null || !files.includes(activePath)) {
    return nextTargetedFile(files, activePath, viewedPaths, direction);
  }
  const unviewed = files.filter((f) => f !== activePath && !viewedPaths.has(f));
  if (unviewed.length === 0) return null;
  return pickSeeded(unviewed, pathSeed(activePath), direction);
}

export function nextReviewFile(
  files: readonly string[],
  activePath: string | null,
  viewedPaths: ReadonlySet<string>,
  direction: 1 | -1,
  randomize: boolean,
): string | null {
  return randomize
    ? nextRandomizedFile(files, activePath, viewedPaths, direction)
    : nextTargetedFile(files, activePath, viewedPaths, direction);
}

export function firstFileToReview(
  files: readonly string[],
  viewedPaths: ReadonlySet<string>,
  randomize = false,
): string | null {
  if (randomize) {
    const unviewed = files.filter((f) => !viewedPaths.has(f));
    const pool = unviewed.length > 0 ? unviewed : files;
    if (pool.length > 0) return pickSeeded(pool, pathSeed(pool.join('\n')), 1);
  }
  return nextTargetedFile(files, null, viewedPaths, 1) ?? files[0] ?? null;
}
