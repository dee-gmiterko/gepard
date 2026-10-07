import { SymbolKind, type DocumentSymbol } from '@gepard/common';

export interface TreeNode<T> {
  path: string;
  name: string;
  isFolder: boolean;
  children: TreeNode<T>[];
  data?: T;
}

interface MutableNode {
  path: string;
  name: string;
  isFolder: boolean;
  children: Map<string, MutableNode>;
}

const collator = new Intl.Collator();

function compareNodes<T>(a: TreeNode<T>, b: TreeNode<T>): number {
  if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
  return collator.compare(a.name, b.name);
}

export function buildTree(paths: readonly string[]): TreeNode<null>[] {
  const root: MutableNode = { path: '', name: '', isFolder: true, children: new Map() };

  for (const path of paths) {
    const parts = path.split('/').filter(Boolean);
    let node = root;
    let acc = '';
    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part;
      const isLast = i === parts.length - 1;
      let child = node.children.get(part);
      if (!child) {
        child = { path: acc, name: part, isFolder: !isLast, children: new Map() };
        node.children.set(part, child);
      }
      if (isLast) child.isFolder = false;
      node = child;
    });
  }

  function toNode(n: MutableNode): TreeNode<null> {
    const children = [...n.children.values()].map(toNode).sort(compareNodes);
    return { path: n.path, name: n.name, isFolder: n.isFolder, children };
  }

  return [...root.children.values()].map(toNode).sort(compareNodes);
}

export function withRoot<T>(nodes: TreeNode<T>[], name: string): TreeNode<T>[] {
  return [{ path: '', name, isFolder: true, children: nodes }];
}

export function buildFlatList(paths: readonly string[]): TreeNode<null>[] {
  return [...paths]
    .sort((a, b) => collator.compare(a, b))
    .map((path) => ({ path, name: path, isFolder: false, children: [] }));
}

export function flattenLeafPaths<T>(nodes: TreeNode<T>[]): string[] {
  const out: string[] = [];
  function walk(list: TreeNode<T>[]): void {
    for (const node of list) {
      if (node.isFolder) walk(node.children);
      else out.push(node.path);
    }
  }
  walk(nodes);
  return out;
}

export interface FlatRow<T> {
  node: TreeNode<T>;
  depth: number;
  parentIndex: number;
  position: number;
  setSize: number;
}

export function flattenVisible<T>(
  nodes: TreeNode<T>[],
  collapsed: ReadonlySet<string>,
): FlatRow<T>[] {
  const out: FlatRow<T>[] = [];
  function walk(list: TreeNode<T>[], depth: number, parentIndex: number): void {
    list.forEach((node, i) => {
      const index = out.length;
      out.push({ node, depth, parentIndex, position: i + 1, setSize: list.length });
      if (node.children.length > 0 && !collapsed.has(node.path))
        walk(node.children, depth + 1, index);
    });
  }
  walk(nodes, 0, -1);
  return out;
}

export interface SymbolRowData {
  kind: DocumentSymbol['kind'];
  line: number;
}

// Only declarations that structure a file are listed; variables, constants, properties, parameters and members are too numerous to help navigation.
const OverviewSymbolKind = SymbolKind.extract([
  'namespace',
  'class',
  'interface',
  'enum',
  'type',
  'function',
  'method',
]);
const OVERVIEW_SYMBOL_KINDS: ReadonlySet<SymbolKind> = new Set(OverviewSymbolKind.options);

export function symbolTreeNodes(
  symbols: DocumentSymbol[],
  parentPath: string,
): TreeNode<SymbolRowData>[] {
  return symbols.flatMap((s, i) => {
    const path = `${parentPath}/${i}:${s.name}`;
    const children = symbolTreeNodes(s.children, path);
    if (!OVERVIEW_SYMBOL_KINDS.has(s.kind)) return children;
    return [
      {
        path,
        name: s.name,
        isFolder: false,
        data: { kind: s.kind, line: s.selectionRange.start.line },
        children,
      },
    ];
  });
}
