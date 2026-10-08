import { z } from 'zod';
import { SourceSymbolModifier, type SourceLineSymbol, type SourceSymbolKind } from '@gepard/common';

export const STANDARD_TOKEN_TYPES = [
  'namespace',
  'type',
  'class',
  'enum',
  'interface',
  'struct',
  'typeParameter',
  'parameter',
  'variable',
  'property',
  'enumMember',
  'event',
  'function',
  'method',
  'macro',
  'keyword',
  'modifier',
  'comment',
  'string',
  'number',
  'regexp',
  'operator',
  'decorator',
];
export const STANDARD_TOKEN_MODIFIERS = [
  'declaration',
  'definition',
  'readonly',
  'static',
  'deprecated',
  'abstract',
  'async',
  'modification',
  'documentation',
  'defaultLibrary',
];

export interface SemanticTokensLegend {
  tokenTypes: string[];
  tokenModifiers: string[];
}

function isSymbolModifier(modifier: string): modifier is SourceSymbolModifier {
  return SourceSymbolModifier.safeParse(modifier).success;
}

export function emptyLegend(): SemanticTokensLegend {
  return { tokenTypes: [], tokenModifiers: [] };
}

export function mapSemanticTokenType(
  type: string | undefined,
  readonly: boolean,
): SourceSymbolKind {
  switch (type) {
    case 'namespace':
      return 'namespace';
    case 'class':
      return 'class';
    case 'interface':
      return 'interface';
    case 'enum':
      return 'enum';
    case 'enumMember':
      return 'enumMember';
    case 'type':
    case 'struct':
      return 'type';
    case 'typeParameter':
      return 'typeParameter';
    case 'function':
      return 'function';
    case 'method':
      return 'method';
    case 'property':
      return 'property';
    case 'parameter':
      return 'parameter';
    case 'variable':
      return readonly ? 'constant' : 'variable';
    default:
      return 'unknown';
  }
}

export function decodeLineSymbols(
  data: number[],
  legend: SemanticTokensLegend,
  line: number,
  lineText: string,
): SourceLineSymbol[] {
  const lineIdx0 = line - 1;
  const out: SourceLineSymbol[] = [];
  let curLine = 0;
  let curChar = 0;
  for (let i = 0; i < data.length; i += 5) {
    const deltaLine = data[i];
    const deltaChar = data[i + 1];
    const length = data[i + 2];
    const typeIdx = data[i + 3];
    const modBits = data[i + 4];
    curLine += deltaLine;
    curChar = deltaLine === 0 ? curChar + deltaChar : deltaChar;
    if (curLine !== lineIdx0) continue;
    const modifiers = legend.tokenModifiers.filter((_, bi) => (modBits & (1 << bi)) !== 0);
    out.push({
      name: lineText.slice(curChar, curChar + length),
      kind: mapSemanticTokenType(legend.tokenTypes[typeIdx], modifiers.includes('readonly')),
      modifiers: modifiers.filter(isSymbolModifier),
      range: { start: { line, col: curChar + 1 }, end: { line, col: curChar + length + 1 } },
    });
  }
  return out;
}

const initializeResultSchema = z.object({
  capabilities: z
    .object({
      semanticTokensProvider: z
        .object({
          legend: z.object({
            tokenTypes: z.array(z.string()),
            tokenModifiers: z.array(z.string()),
          }),
          range: z.union([z.boolean(), z.object({})]).optional(),
          full: z.union([z.boolean(), z.object({})]).optional(),
        })
        .optional(),
    })
    .optional(),
});

export type SemanticTokensRequest = 'range' | 'full';

export interface SemanticTokensSupport {
  legend: SemanticTokensLegend;
  // null when the server serves no semantic tokens.
  request: SemanticTokensRequest | null;
}

export function semanticTokensSupportOf(initializeResult: unknown): SemanticTokensSupport {
  const parsed = initializeResultSchema.safeParse(initializeResult);
  const provider = parsed.success ? parsed.data.capabilities?.semanticTokensProvider : undefined;
  if (!provider) return { legend: emptyLegend(), request: null };
  const request = provider.range ? 'range' : provider.full ? 'full' : null;
  return { legend: provider.legend, request };
}
