import type { ImportResolution } from './lsp';

function normalize(path: string): string | null {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (parts.length === 0) return null;
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join('/');
}

function dirname(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

function withoutSuffix(path: string, suffixes: readonly string[]): string {
  const suffix = suffixes.find((s) => path.endsWith(s) && path.length > s.length);
  return suffix ? path.slice(0, -suffix.length) : path;
}

export async function resolveImportSpecifier(
  fromPath: string,
  specifier: string,
  rules: ImportResolution,
  isFile: (path: string) => Promise<boolean>,
): Promise<string | null> {
  if (!specifier || /^[a-z][a-z0-9+.-]*:/i.test(specifier)) return null;
  const relative = specifier.startsWith('./') || specifier.startsWith('../');
  const bases = relative
    ? [`${dirname(fromPath)}/${specifier}`]
    : [`${dirname(fromPath)}/${specifier}`, specifier];
  const extensions = ['', ...rules.extensions];
  for (const raw of bases) {
    const base = normalize(raw);
    if (base === null || base === '') continue;
    const stem = withoutSuffix(base, rules.emittedExtensions);
    const candidates = [
      ...extensions.map((ext) => base + ext),
      ...(stem !== base ? extensions.map((ext) => stem + ext) : []),
      ...rules.indexFiles.map((index) => `${base}/${index}`),
    ];
    for (const candidate of candidates) {
      if (await isFile(candidate)) return candidate;
    }
  }
  return null;
}
