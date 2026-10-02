import type { z } from 'zod';
import type { DocumentSymbol } from '../ipc/schemas/lsp';
import { SymbolKind } from '../ipc/schemas/search';

const NoiseSymbolKind = SymbolKind.extract(['typeParameter', 'parameter', 'unknown']);
const NOISE: ReadonlySet<SymbolKind> = new Set(NoiseSymbolKind.options);
// Only members of type-level declarations are declarations themselves; children of functions,
// methods and variables are locals, callbacks and object-literal members.
const ContainerSymbolKind = SymbolKind.extract(['namespace', 'class', 'interface', 'enum']);
const CONTAINERS: ReadonlySet<SymbolKind> = new Set(ContainerSymbolKind.options);

export function navigationSymbols(symbols: DocumentSymbol[]): DocumentSymbol[] {
  return symbols
    .filter((s) => !NOISE.has(s.kind))
    .map((s) => ({ ...s, children: CONTAINERS.has(s.kind) ? navigationSymbols(s.children) : [] }));
}

// Type-level definitions worth navigating to by name; functions, variables and members are left
// to the in-file symbol tree.
export const DefinitionSymbolKind = SymbolKind.extract([
  'namespace',
  'class',
  'interface',
  'enum',
  'type',
]);
export type DefinitionSymbolKind = z.infer<typeof DefinitionSymbolKind>;
