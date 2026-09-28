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
  return isGlob(target) ? globToRegExp(target).test(path) : isWithin(path, target);
}

export function isTargeted(path: string, targetedPaths: readonly string[]): boolean {
  return targetedPaths.some((t) => matchesTarget(path, t));
}
