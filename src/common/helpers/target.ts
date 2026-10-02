import picomatch from 'picomatch';

export function isWithin(path: string, target: string): boolean {
  const prefix = target.endsWith('/') ? target : `${target}/`;
  return path === target || path.startsWith(prefix);
}

const GLOB_CHARS = /[*?[]/;

export function isGlob(target: string): boolean {
  return GLOB_CHARS.test(target);
}

export function globToRegExp(glob: string): RegExp {
  return picomatch.makeRe(glob, { dot: true, posix: true, windows: false });
}

export function staticPrefixOf(target: string): string {
  const globIdx = target.search(GLOB_CHARS);
  if (globIdx === -1) return target;
  const slashIdx = target.lastIndexOf('/', globIdx);
  return slashIdx === -1 ? '' : target.slice(0, slashIdx);
}

export function matchesTarget(path: string, target: string): boolean {
  if (isGlob(target)) return globToRegExp(target).test(path);
  return isWithin(path, target) || path.includes(target);
}

export function isTargeted(path: string, targetedPaths: readonly string[]): boolean {
  return targetedPaths.some((t) => matchesTarget(path, t));
}

export function makeTargetMatcher(targets: readonly string[]): (path: string) => boolean {
  const exact = new Set<string>();
  const literals: string[] = [];
  const globs: RegExp[] = [];
  for (const target of targets) {
    if (isGlob(target)) {
      globs.push(globToRegExp(target));
    } else {
      exact.add(target);
      literals.push(target);
    }
  }
  return (path) =>
    exact.has(path) ||
    globs.some((re) => re.test(path)) ||
    literals.some((target) => matchesTarget(path, target));
}
