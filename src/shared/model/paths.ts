export function isWithin(path: string, target: string): boolean {
  const prefix = target.endsWith('/') ? target : `${target}/`
  return path === target || path.startsWith(prefix)
}

const GLOB_CHARS = /[*?[]/

export function isGlob(target: string): boolean {
  return GLOB_CHARS.test(target)
}

export function globToRegExp(glob: string): RegExp {
  let out = '^'
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        out += '.*'
        i++
      } else {
        out += '[^/]*'
      }
    } else if (c === '?') {
      out += '[^/]'
    } else if (c === '[') {
      const end = glob.indexOf(']', i + 1)
      if (end === -1) {
        out += '\\['
      } else {
        out += `[${glob.slice(i + 1, end)}]`
        i = end
      }
    } else {
      out += c.replace(/[.+^${}()|\\]/g, '\\$&')
    }
  }
  return new RegExp(`${out}$`)
}

/** Safe to pass to git as a literal pathspec: it names a real ancestor
 * directory, so it always matches a superset of what the glob matches. */
export function staticPrefixOf(target: string): string {
  const globIdx = target.search(GLOB_CHARS)
  if (globIdx === -1) return target
  const slashIdx = target.lastIndexOf('/', globIdx)
  return slashIdx === -1 ? '' : target.slice(0, slashIdx)
}

export function matchesTarget(path: string, target: string): boolean {
  return isGlob(target) ? globToRegExp(target).test(path) : isWithin(path, target)
}

export function isTargeted(path: string, targetedPaths: readonly string[]): boolean {
  return targetedPaths.some((t) => matchesTarget(path, t))
}
