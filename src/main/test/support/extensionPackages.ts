import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function writePackage(
  root: string,
  name: string,
  body: string,
  manifestOverrides: Record<string, unknown> = {},
): Promise<string> {
  const pkgDir = join(root, name);
  await mkdir(pkgDir, { recursive: true });
  await writeFile(
    join(pkgDir, 'package.json'),
    JSON.stringify({
      name,
      private: true,
      main: 'index.js',
      gepard: { type: 'lsp' },
      ...manifestOverrides,
    }),
  );
  await writeFile(join(pkgDir, 'index.js'), body);
  return pkgDir;
}

export const DEMO_LANG_BODY = `module.exports = {
  id: 'demo-lang',
  displayName: 'Demo Lang',
  languages: [{ name: 'demo', extensions: ['demo'] }],
  open: async () => ({
    lineSymbols: async () => [],
    definition: async () => [],
    references: async () => [],
    workspaceSymbols: async () => [],
    documentSymbols: async () => [],
    filesChanged: () => {},
    dispose: async () => {},
  })
}`;

export const DEMO_GRAMMAR_BODY = `module.exports = {
  id: 'demo-grammar',
  displayName: 'Demo Grammar',
  languages: [{ name: 'Demo', extensions: ['demo'], filenames: ['Demofile'] }],
  support: (api) => api.StreamLanguage.define({ token: (s) => { s.skipToEnd(); return 'keyword'; } })
}`;

const THEME_COLOR_KEYS = [
  'bg',
  'bgSubtle',
  'bgElevated',
  'bgHover',
  'bgSelected',
  'fg',
  'fgMuted',
  'fgSubtle',
  'border',
  'borderStrong',
  'accent',
  'accentFg',
  'danger',
  'success',
  'warning',
  'diffAddBg',
  'diffAddFg',
  'diffDelBg',
  'diffDelFg',
  'diffHunk',
  'commentBg',
  'overlay',
];
const THEME_SYNTAX_KEYS = [
  'keyword',
  'string',
  'number',
  'comment',
  'type',
  'function',
  'property',
  'constant',
  'tag',
  'invalid',
];

export const DEMO_THEME_BODY = `const colorKeys = ${JSON.stringify(THEME_COLOR_KEYS)}
const syntaxKeys = ${JSON.stringify(THEME_SYNTAX_KEYS)}
module.exports = {
  id: 'demo-theme',
  name: 'Demo Theme',
  mode: 'dark',
  shadow: { popover: '0 0 0', floating: '0 0 0' },
  colors: Object.fromEntries(colorKeys.map((k) => [k, '#000000'])),
  syntax: Object.fromEntries(syntaxKeys.map((k) => [k, '#000000']))
}`;
