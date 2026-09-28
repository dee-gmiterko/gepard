import { globToRegExp, isGlob, matchesTarget } from './paths';

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
