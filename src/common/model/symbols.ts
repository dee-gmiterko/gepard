import type { DocumentSymbol } from '../ipc/schemas/lsp';

type SymbolKind = DocumentSymbol['kind'];

const NOISE: ReadonlySet<SymbolKind> = new Set(['typeParameter', 'parameter', 'unknown']);
// Only members of type-level declarations are declarations themselves; children of functions,
// methods and variables are locals, callbacks and object-literal members.
const CONTAINERS: ReadonlySet<SymbolKind> = new Set(['namespace', 'class', 'interface', 'enum']);

export function navigationSymbols(symbols: DocumentSymbol[]): DocumentSymbol[] {
  return symbols
    .filter((s) => !NOISE.has(s.kind))
    .map((s) => ({ ...s, children: CONTAINERS.has(s.kind) ? navigationSymbols(s.children) : [] }));
}

// Type-level definitions worth navigating to by name; functions, variables and members are left
// to the in-file symbol tree.
export const definitionKinds: readonly SymbolKind[] = [
  'namespace',
  'class',
  'interface',
  'enum',
  'type',
];
