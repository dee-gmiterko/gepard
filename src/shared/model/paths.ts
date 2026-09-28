export function isWithin(path: string, target: string): boolean {
  const prefix = target.endsWith('/') ? target : `${target}/`;
  return path === target || path.startsWith(prefix);
}

const GLOB_CHARS = /[*?[]/;

export function isGlob(target: string): boolean {
  return GLOB_CHARS.test(target);
}

function segmentToRegExp(segment: string): string {
  let out = '';
  for (let i = 0; i < segment.length; i++) {
    const c = segment[i];
    if (c === '*') {
      out += '[^/]*';
    } else if (c === '?') {
      out += '[^/]';
    } else if (c === '[') {
      const end = segment.indexOf(']', i + 1);
      if (end === -1) {
        out += '\\[';
      } else {
        let body = segment.slice(i + 1, end);
        if (body.startsWith('!')) body = `^${body.slice(1)}`;
        out += `[${body}]`;
        i = end;
      }
    } else {
      out += c.replace(/[.+^${}()|\\]/g, '\\$&');
    }
  }
  return out;
}

export function globToRegExp(glob: string): RegExp {
  const segments = glob.split('/');
  let out = '';
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (segment === '**') {
      if (segments.length === 1) out += '.*';
      else if (i === 0) out += '(?:.*/)?';
      else if (i === segments.length - 1) out += '(?:/.*)?';
      else out += '(?:/.*)?';
      continue;
    }
    const prev = segments[i - 1];
    if (i > 0 && !(prev === '**' && i === 1)) out += '/';
    out += segmentToRegExp(segment);
  }
  return new RegExp(`^${out}$`);
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
