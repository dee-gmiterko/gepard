import {
  languageIdOf,
  type ExtensionEvents,
  type ExtensionLanguage,
  type SourceDocumentSymbol,
  type SourceLineSymbol,
  type SourcePos,
} from '@gepard/common';
import { StdioLspSession, TransientDocuments, type StdioServerSpec } from '@gepard/common-lsp';

export interface ServerSpec extends StdioServerSpec {
  languages: ExtensionLanguage[];
}

interface ImportStatement {
  start: number;
  end: number;
}

interface ImportScan {
  statements: ImportStatement[];
  specifiers: { start: number; end: number }[];
}

const STATIC_IMPORT = /^[ \t]*import\b(?![ \t]*[(.])[^;'"]*?(['"])(.*?)\1/gm;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*(['"])(.*?)\1/g;

function scanImports(text: string): ImportScan {
  const statements: ImportStatement[] = [];
  const specifiers: { start: number; end: number }[] = [];
  for (const m of text.matchAll(STATIC_IMPORT)) {
    const end = m.index + m[0].length;
    statements.push({ start: m.index, end });
    specifiers.push({ start: end - m[2].length - 1, end: end - 1 });
  }
  for (const m of text.matchAll(DYNAMIC_IMPORT)) {
    const end = m.index + m[0].length;
    specifiers.push({ start: end - m[2].length - 1, end: end - 1 });
  }
  return { statements, specifiers };
}

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return starts;
}

function offsetOf(starts: number[], pos: SourcePos): number {
  return (starts[pos.line - 1] ?? 0) + pos.col - 1;
}

function posOf(starts: number[], offset: number): SourcePos {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, col: offset - starts[lo] + 1 };
}

export class TypeScriptSession extends StdioLspSession<ServerSpec> {
  protected readonly documents = new TransientDocuments(this.documentHost());

  private constructor(spec: ServerSpec, sink: ExtensionEvents) {
    super(spec, sink);
  }

  static async start(spec: ServerSpec, sink: ExtensionEvents): Promise<TypeScriptSession> {
    const session = new TypeScriptSession(spec, sink);
    await session.launch();
    return session;
  }

  protected languageId(filePath: string): string {
    return languageIdOf(this.spec.languages, filePath) ?? '';
  }

  async documentSymbols(filePath: string): Promise<SourceDocumentSymbol[]> {
    const [symbols, text] = await Promise.all([
      super.documentSymbols(filePath),
      this.withOpenDocument(this.absPath(filePath), (t): Promise<string> => Promise.resolve(t)),
    ]);
    const { statements } = scanImports(text);
    if (statements.length === 0) return symbols;
    const starts = lineStarts(text);
    const reclassify = (s: SourceDocumentSymbol): SourceDocumentSymbol => {
      const at = offsetOf(starts, s.selectionRange.start);
      const inImport = statements.some((st): boolean => at >= st.start && at < st.end);
      return {
        ...s,
        kind: inImport ? 'import' : s.kind,
        children: s.children.map(reclassify),
      };
    };
    return symbols.map(reclassify);
  }

  async lineSymbols(filePath: string, line: number): Promise<SourceLineSymbol[]> {
    const [base, symbols, text] = await Promise.all([
      super.lineSymbols(filePath, line),
      this.documentSymbols(filePath),
      this.withOpenDocument(this.absPath(filePath), (t): Promise<string> => Promise.resolve(t)),
    ]);
    const { specifiers } = scanImports(text);
    const starts = lineStarts(text);
    const out = base.filter((s): boolean => s.kind !== 'unknown' || s.name.length > 0);
    const bindings = symbols.filter(
      (s) => s.kind === 'import' && s.selectionRange.start.line === line,
    );
    const imports: SourceLineSymbol[] = [];
    for (const b of bindings) {
      imports.push({
        name: text.slice(
          offsetOf(starts, b.selectionRange.start),
          offsetOf(starts, b.selectionRange.end),
        ),
        kind: 'import',
        modifiers: ['declaration'],
        range: b.selectionRange,
      });
    }
    for (const sp of specifiers) {
      const start = posOf(starts, sp.start);
      if (start.line !== line) continue;
      imports.push({
        name: text.slice(sp.start, sp.end),
        kind: 'import',
        modifiers: [],
        range: { start, end: posOf(starts, sp.end) },
      });
    }
    const overlaps = (a: SourceLineSymbol): boolean =>
      imports.some(
        (i): boolean => a.range.start.col < i.range.end.col && i.range.start.col < a.range.end.col,
      );
    return [...out.filter((s): boolean => !overlaps(s)), ...imports].sort(
      (a, b): number => a.range.start.col - b.range.start.col,
    );
  }
}
