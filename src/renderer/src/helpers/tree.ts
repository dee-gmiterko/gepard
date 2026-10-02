import type { DocumentSymbol } from '@gepard/common';

export interface TreeNode<T> {
  path: string;
  name: string;
  isFolder: boolean;
  children: TreeNode<T>[];
  data?: T;
}

interface Item<T> {
  path: string;
  data: T;
}

interface BuildTreeOptions<T> {
  aggregateFolder?: (childData: T[]) => T;
}

interface MutableNode<T> {
  path: string;
  name: string;
  isFolder: boolean;
  children: Map<string, MutableNode<T>>;
  data?: T;
}

const collator = new Intl.Collator();

function compareNodes<T>(a: TreeNode<T>, b: TreeNode<T>): number {
  if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
  return collator.compare(a.name, b.name);
}

export function buildTree<T>(items: Item<T>[], options: BuildTreeOptions<T> = {}): TreeNode<T>[] {
  const root: MutableNode<T> = { path: '', name: '', isFolder: true, children: new Map() };

  for (const { path, data } of items) {
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
      if (isLast) {
        child.isFolder = false;
        child.data = data;
      }
      node = child;
    });
  }

  function toNode(n: MutableNode<T>): TreeNode<T> {
    const children = [...n.children.values()].map(toNode).sort(compareNodes);
    const data = n.isFolder
      ? options.aggregateFolder?.(
          children.map((c) => c.data).filter((d): d is T => d !== undefined),
        )
      : n.data;
    return { path: n.path, name: n.name, isFolder: n.isFolder, children, data };
  }

  return [...root.children.values()].map(toNode).sort(compareNodes);
}

export function withRoot<T>(
  nodes: TreeNode<T>[],
  name: string,
  options: BuildTreeOptions<T> = {},
): TreeNode<T>[] {
  const data = options.aggregateFolder?.(
    nodes.map((n) => n.data).filter((d): d is T => d !== undefined),
  );
  return [{ path: '', name, isFolder: true, children: nodes, data }];
}

export function buildFlatList<T>(items: Item<T>[]): TreeNode<T>[] {
  return [...items]
    .sort((a, b) => collator.compare(a.path, b.path))
    .map((item) => ({
      path: item.path,
      name: item.path,
      isFolder: false,
      children: [],
      data: item.data,
    }));
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

export interface SymbolRowData {
  kind: DocumentSymbol['kind'];
  line: number;
}

export function symbolTreeNodes(
  symbols: DocumentSymbol[],
  parentPath: string,
): TreeNode<SymbolRowData>[] {
  return symbols.map((s, i) => {
    const path = `${parentPath}/${i}:${s.name}`;
    return {
      path,
      name: s.name,
      isFolder: false,
      data: { kind: s.kind, line: s.selectionRange.start.line },
      children: symbolTreeNodes(s.children, path),
    };
  });
}
