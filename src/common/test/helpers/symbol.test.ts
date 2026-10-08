import { describe, expect, it } from 'vitest';
import { navigationSymbols } from '../../helpers/symbol';
import type { DocumentSymbol } from '../../ipc/schemas/lsp';

function sym(
  name: string,
  kind: DocumentSymbol['kind'],
  children: DocumentSymbol[] = [],
): DocumentSymbol {
  const range = { start: { line: 1, col: 1 }, end: { line: 1, col: 1 } };
  return { name, kind, range, selectionRange: range, children };
}

const names = (symbols: DocumentSymbol[]): unknown =>
  symbols.map((s) => (s.children.length ? { [s.name]: names(s.children) } : s.name));

describe('navigationSymbols', () => {
  it('keeps top-level declarations and drops noise kinds', () => {
    const out = navigationSymbols([
      sym('Foo', 'class'),
      sym('T', 'typeParameter'),
      sym('run', 'function'),
      sym('config', 'variable'),
      sym('LIMIT', 'constant'),
      sym('Shape', 'type'),
      sym('arg', 'parameter'),
      sym('??', 'unknown'),
    ]);
    expect(names(out)).toEqual(['Foo', 'run', 'config', 'LIMIT', 'Shape']);
  });

  it('drops locals, callbacks and object-literal members', () => {
    const out = navigationSymbols([
      sym('Component', 'function', [
        sym('state', 'variable'),
        sym('handleClick', 'function'),
        sym('useEffect() callback', 'function'),
      ]),
      sym('handlers', 'variable', [sym('open', 'property'), sym('close', 'property')]),
    ]);
    expect(names(out)).toEqual(['Component', 'handlers']);
  });

  it('keeps members of namespaces, classes, interfaces and enums recursively', () => {
    const out = navigationSymbols([
      sym('Api', 'namespace', [
        sym('Client', 'class', [
          sym('constructor', 'method'),
          sym('baseUrl', 'property'),
          sym('fetch', 'method', [sym('res', 'variable')]),
          sym('T', 'typeParameter'),
        ]),
        sym('Options', 'interface', [sym('retries', 'property'), sym('onError', 'method')]),
        sym('Mode', 'enum', [sym('Fast', 'enumMember'), sym('Safe', 'enumMember')]),
      ]),
    ]);
    expect(names(out)).toEqual([
      {
        Api: [
          { Client: ['constructor', 'baseUrl', 'fetch'] },
          { Options: ['retries', 'onError'] },
          { Mode: ['Fast', 'Safe'] },
        ],
      },
    ]);
  });
});
