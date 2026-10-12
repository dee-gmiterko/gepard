import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const RENDERER_SRC_DIR = path.join(ROOT_DIR, 'src/renderer/src');
const THEMES_DIR = path.join(ROOT_DIR, 'extensions/themes');

export const COLOR_TOKENS = [
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
] as const;
export const SYNTAX_TOKENS = [
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
] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];
export type SyntaxToken = (typeof SYNTAX_TOKENS)[number];
export type Token = `colors.${ColorToken}` | `syntax.${SyntaxToken}`;

export interface ThemeLike {
  id: string;
  name: string;
  mode: 'light' | 'dark';
  contrast?: 'normal' | 'high';
  colors: Record<ColorToken, string>;
  syntax: Record<SyntaxToken, string>;
}

// Surfaces every component may be laid on without naming them: page, panel and popover backgrounds.
const BASE_SURFACES: Token[] = ['colors.bg', 'colors.bgSubtle', 'colors.bgElevated'];
// Fills like `accent` or `success` never carry inherited text, so only these count as surfaces.
const SURFACE_TOKENS = new Set<Token>(
  COLOR_TOKENS.filter((t) => /^bg|Bg$|^diffHunk$/.test(t)).map((t) => `colors.${t}` as Token),
);

const FG_PROPS = new Set(['color', 'fill', 'stroke', 'caret-color', '-webkit-text-fill-color']);
const BG_PROPS = new Set(['background', 'background-color']);
const BORDER_PROPS = new Set(['outline', 'outline-color', 'box-shadow']);

export type PairKind = 'text' | 'border';
export type PairOrigin = 'declared' | 'inherited';

export interface TokenPair {
  kind: PairKind;
  fg: Token;
  bg: Token;
  origin: PairOrigin;
  sources: string[];
}

interface Declaration {
  role: 'fg' | 'bg' | 'border';
  tokens: Token[];
}

const TOKEN_REF = /\b(?:theme\.)?(colors|syntax)\.([A-Za-z]+)\b|\b([cs])\.([A-Za-z]+)\b/g;

function tokensIn(text: string): Token[] {
  const found: Token[] = [];
  for (const match of text.matchAll(TOKEN_REF)) {
    const [, group, name, alias, aliasName] = match;
    const kind = group ?? (alias === 'c' ? 'colors' : 'syntax');
    const token = name ?? aliasName;
    const valid =
      kind === 'colors'
        ? (COLOR_TOKENS as readonly string[]).includes(token)
        : (SYNTAX_TOKENS as readonly string[]).includes(token);
    if (valid) found.push(`${kind}.${token}` as Token);
  }
  return found;
}

// Only tokens and nested templates survive a `${}`, so JS braces never leak into the CSS tree.
export function flattenTemplates(source: string): string {
  let out = '';
  let i = 0;

  function readTemplate(): string {
    let text = '';
    i++;
    while (i < source.length) {
      const ch = source[i];
      if (ch === '\\') {
        text += source[i + 1] ?? '';
        i += 2;
        continue;
      }
      if (ch === '`') {
        i++;
        return ` { ${text} } `;
      }
      if (ch === '$' && source[i + 1] === '{') {
        i += 2;
        text += ` ${readExpression()} `;
        continue;
      }
      text += ch;
      i++;
    }
    return ` { ${text} } `;
  }

  function readExpression(): string {
    let depth = 1;
    let plain = '';
    let nested = '';
    while (i < source.length) {
      const ch = source[i];
      if (ch === '`') {
        nested += readTemplate();
        continue;
      }
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
      plain += ch;
      i++;
    }
    return `${tokensIn(plain).join(' ')} ${nested}`;
  }

  while (i < source.length) {
    const ch = source[i];
    if (ch === '`') {
      out += readTemplate();
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

function propertyRole(rawProp: string): Declaration['role'] | null {
  const prop = rawProp
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  if (FG_PROPS.has(prop)) return 'fg';
  if (BG_PROPS.has(prop)) return 'bg';
  if (BORDER_PROPS.has(prop) || prop.startsWith('border')) return 'border';
  return null;
}

function parseDeclarations(chunk: string): Declaration[] {
  const declarations: Declaration[] = [];
  for (const statement of chunk.split(/[;,\n]/)) {
    const colon = statement.indexOf(':');
    if (colon < 0) continue;
    const role = propertyRole(statement.slice(0, colon));
    if (!role) continue;
    const tokens = tokensIn(statement.slice(colon + 1));
    if (tokens.length > 0) declarations.push({ role, tokens });
  }
  return declarations;
}

export interface Block {
  fg: Set<Token>;
  bg: Set<Token>;
  border: Set<Token>;
}

interface Node {
  declarations: Declaration[];
  children: Node[];
}

function parseTree(flat: string): Node {
  const root: Node = { declarations: [], children: [] };
  const stack: Node[] = [root];
  let chunk = '';

  function flushChunk(): void {
    stack[stack.length - 1].declarations.push(...parseDeclarations(chunk));
    chunk = '';
  }

  for (const ch of flat) {
    if (ch === '{') {
      flushChunk();
      const node: Node = { declarations: [], children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else if (ch === '}') {
      flushChunk();
      if (stack.length > 1) stack.pop();
    } else {
      chunk += ch;
    }
  }
  flushChunk();
  return root;
}

export interface SourceAnalysis {
  blocks: Block[];
  backgrounds: Set<Token>;
}

// A block inherits the colours it doesn't set from its enclosing blocks, never from siblings.
export function analyzeSource(source: string): SourceAnalysis {
  const blocks: Block[] = [];
  const backgrounds = new Set<Token>();

  function visit(node: Node, inherited: Block): void {
    const effective: Block = {
      fg: new Set(inherited.fg),
      bg: new Set(inherited.bg),
      border: new Set(inherited.border),
    };
    for (const { role, tokens } of node.declarations) {
      for (const token of tokens) {
        effective[role].add(token);
        if (role === 'bg') backgrounds.add(token);
      }
    }
    if (node.declarations.length > 0) blocks.push(effective);
    for (const child of node.children) visit(child, effective);
  }

  visit(parseTree(flattenTemplates(source)), { fg: new Set(), bg: new Set(), border: new Set() });
  return { blocks, backgrounds };
}

function pairKey(kind: PairKind, fg: Token, bg: Token): string {
  return `${kind}|${fg}|${bg}`;
}

export function collectPairs(files: { name: string; source: string }[]): TokenPair[] {
  const pairs = new Map<string, TokenPair>();

  function add(kind: PairKind, fg: Token, bg: Token, origin: PairOrigin, name: string): void {
    if (fg === bg || bg === 'colors.overlay') return;
    const key = pairKey(kind, fg, bg);
    const existing = pairs.get(key);
    if (existing) {
      if (origin === 'declared') existing.origin = 'declared';
      if (!existing.sources.includes(name)) existing.sources.push(name);
      return;
    }
    pairs.set(key, { kind, fg, bg, origin, sources: [name] });
  }

  for (const { name, source } of files) {
    const { blocks, backgrounds } = analyzeSource(source);
    const fileSurfaces = new Set<Token>([
      ...BASE_SURFACES,
      ...[...backgrounds].filter((bg) => SURFACE_TOKENS.has(bg)),
    ]);
    for (const block of blocks) {
      const surfaces = block.bg.size > 0 ? block.bg : null;
      for (const fg of block.fg) {
        if (surfaces) for (const bg of surfaces) add('text', fg, bg, 'declared', name);
        else for (const bg of fileSurfaces) add('text', fg, bg, 'inherited', name);
      }
      for (const border of block.border) {
        if (surfaces) for (const bg of surfaces) add('border', border, bg, 'declared', name);
        else for (const bg of fileSurfaces) add('border', border, bg, 'inherited', name);
      }
    }
  }

  return [...pairs.values()].sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.fg.localeCompare(b.fg) || a.bg.localeCompare(b.bg),
  );
}

export function listSourceFiles(dir: string = RENDERER_SRC_DIR): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...listSourceFiles(full));
    else if (/\.tsx?$/.test(entry) && !entry.endsWith('.d.ts')) files.push(full);
  }
  return files.sort();
}

export function collectRendererPairs(dir: string = RENDERER_SRC_DIR): TokenPair[] {
  return collectPairs(
    listSourceFiles(dir).map((file) => ({
      name: path.relative(ROOT_DIR, file),
      source: readFileSync(file, 'utf8'),
    })),
  );
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseColor(value: string): Rgb {
  const text = value.trim();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(text);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3 || digits.length === 4) {
      digits = [...digits].map((d) => d + d).join('');
    }
    if (digits.length !== 6 && digits.length !== 8) throw new Error(`bad colour: ${value}`);
    const n = (offset: number): number => parseInt(digits.slice(offset, offset + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: digits.length === 8 ? n(6) / 255 : 1 };
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(
    text,
  );
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: rgb[4] === undefined ? 1 : Number(rgb[4]),
    };
  }
  throw new Error(`bad colour: ${value}`);
}

export function composite(top: Rgb, under: Rgb): Rgb {
  const mix = (t: number, u: number): number => t * top.a + u * (1 - top.a);
  return { r: mix(top.r, under.r), g: mix(top.g, under.g), b: mix(top.b, under.b), a: 1 };
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const bg = composite(parseColor(background), { r: 255, g: 255, b: 255, a: 1 });
  const fg = composite(parseColor(foreground), bg);
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}

export const WCAG = { aaText: 4.5, aaaText: 7, aaUi: 3 } as const;

const BODY_TEXT: Token[] = ['colors.fg', 'colors.fgMuted'];

export function requiredRatio(pair: TokenPair): number {
  if (pair.kind === 'border') return WCAG.aaUi;
  return BODY_TEXT.includes(pair.fg) ? WCAG.aaaText : WCAG.aaText;
}

export function tokenValue(theme: ThemeLike, token: Token): string {
  const [group, name] = token.split('.') as ['colors' | 'syntax', string];
  return group === 'colors' ? theme.colors[name as ColorToken] : theme.syntax[name as SyntaxToken];
}

export interface PairResult extends TokenPair {
  ratio: number;
  required: number;
  passes: boolean;
}

export function evaluateTheme(theme: ThemeLike, pairs: readonly TokenPair[]): PairResult[] {
  return pairs.map((pair) => {
    const ratio = contrastRatio(tokenValue(theme, pair.fg), tokenValue(theme, pair.bg));
    const required = requiredRatio(pair);
    return { ...pair, ratio, required, passes: ratio >= required };
  });
}

export async function loadBundledThemes(dir: string = THEMES_DIR): Promise<ThemeLike[]> {
  const themes: ThemeLike[] = [];
  for (const name of readdirSync(dir).sort()) {
    const entry = path.join(dir, name, 'index.mjs');
    const mod = (await import(pathToFileURL(entry).href)) as { default: ThemeLike };
    themes.push(mod.default);
  }
  return themes;
}

function formatReport(theme: ThemeLike, results: readonly PairResult[], all: boolean): string {
  const rows = results.filter((r) => all || !r.passes);
  const failing = results.filter((r) => !r.passes).length;
  const lines = [`${theme.name} (${theme.id}): ${results.length} pairs, ${failing} failing`];
  for (const r of rows) {
    const flag = r.passes ? 'ok  ' : 'FAIL';
    lines.push(
      `  ${flag} ${r.kind.padEnd(6)} ${r.ratio.toFixed(2).padStart(5)} >= ${r.required} ` +
        `${r.fg} on ${r.bg} (${r.origin})`,
    );
  }
  return lines.join('\n');
}

async function main({ all }: { all: boolean }): Promise<void> {
  const pairs = collectRendererPairs();
  const themes = await loadBundledThemes();
  let failed = false;
  for (const theme of themes) {
    const results = evaluateTheme(theme, pairs);
    if (theme.contrast === 'high' && results.some((r) => !r.passes)) failed = true;
    console.log(formatReport(theme, results, all));
  }
  if (failed) process.exitCode = 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const argv = yargs(hideBin(process.argv))
    .option('all', { type: 'boolean', default: false, description: 'List passing pairs too' })
    .strict()
    .parseSync();

  void main({ all: argv.all });
}
