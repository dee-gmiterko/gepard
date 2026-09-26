// Repo-relative path helpers shared by main (search scoping) and the
// renderer (targeted lists, reference quick-selects). Pure, no imports.

/** `path` is `target` itself or nested under the folder `target`. */
export function isWithin(path: string, target: string): boolean {
  const prefix = target.endsWith('/') ? target : `${target}/`
  return path === target || path.startsWith(prefix)
}

/** A path is targeted if it is one of the targeted entries (files or
 * folders) or nested under one of them (report 03 §7 `targetedPaths`). */
export function isTargeted(path: string, targetedPaths: readonly string[]): boolean {
  return targetedPaths.some((t) => isWithin(path, t))
}
