const EXTENSIONS = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.d.ts',
  '.vue',
  '.svelte',
];
const INDEX_FILES = ['index.ts', 'index.tsx', 'index.js', 'index.jsx', 'index.mjs', 'index.cjs'];

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

export function resolveImportPath(
  fromPath: string,
  spec: string,
  files: ReadonlySet<string>,
): string | null {
  if (!spec || /^[a-z][a-z0-9+.-]*:/i.test(spec)) return null;
  const relative = spec.startsWith('./') || spec.startsWith('../');
  const bases = relative
    ? [`${dirname(fromPath)}/${spec}`]
    : [`${dirname(fromPath)}/${spec}`, spec];
  for (const raw of bases) {
    const base = normalize(raw);
    if (base === null || base === '') continue;
    const stem = base.replace(/\.(m|c)?js$/, '');
    const candidates = [
      ...EXTENSIONS.map((ext) => base + ext),
      ...(stem !== base ? EXTENSIONS.map((ext) => stem + ext) : []),
      ...INDEX_FILES.map((index) => `${base}/${index}`),
    ];
    const found = candidates.find((c) => files.has(c));
    if (found) return found;
  }
  return null;
}
