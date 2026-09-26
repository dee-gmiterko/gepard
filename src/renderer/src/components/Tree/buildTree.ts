// Pure tree-building helpers shared by the file browser, targeted browser and
// search results (spec: "Tree or flat list" in all three). No React; safe to
// reason about independent of rendering.

export interface TreeNode<T> {
  path: string
  name: string
  isFolder: boolean
  children: TreeNode<T>[]
  data?: T
}

interface Item<T> {
  path: string
  data: T
}

interface BuildTreeOptions<T> {
  /** Combines the data of a folder's direct children (files and
   * already-aggregated subfolders) into that folder's own data, bottom-up.
   * Omit to leave folder nodes without data (plain grouping, e.g. the full
   * file tree). */
  aggregateFolder?: (childData: T[]) => T
}

interface MutableNode<T> {
  path: string
  name: string
  isFolder: boolean
  children: Map<string, MutableNode<T>>
  data?: T
}

function compareNodes<T>(a: TreeNode<T>, b: TreeNode<T>): number {
  if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
  return a.name.localeCompare(b.name)
}

/** Nests a flat list of repo-relative paths into a folder tree. */
export function buildTree<T>(items: Item<T>[], options: BuildTreeOptions<T> = {}): TreeNode<T>[] {
  const root: MutableNode<T> = { path: '', name: '', isFolder: true, children: new Map() }

  for (const { path, data } of items) {
    const parts = path.split('/').filter(Boolean)
    let node = root
    let acc = ''
    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part
      const isLast = i === parts.length - 1
      let child = node.children.get(part)
      if (!child) {
        child = { path: acc, name: part, isFolder: !isLast, children: new Map() }
        node.children.set(part, child)
      }
      if (isLast) {
        child.isFolder = false
        child.data = data
      }
      node = child
    })
  }

  function toNode(n: MutableNode<T>): TreeNode<T> {
    const children = [...n.children.values()].map(toNode).sort(compareNodes)
    const data = n.isFolder
      ? options.aggregateFolder?.(
          children.map((c) => c.data).filter((d): d is T => d !== undefined)
        )
      : n.data
    return { path: n.path, name: n.name, isFolder: n.isFolder, children, data }
  }

  return [...root.children.values()].map(toNode).sort(compareNodes)
}

/** Same items, no folder nesting: one row per file, named by its full path
 * (spec: "Tree or flat list"). */
export function buildFlatList<T>(items: Item<T>[]): TreeNode<T>[] {
  return [...items]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((item) => ({
      path: item.path,
      name: item.path,
      isFolder: false,
      children: [],
      data: item.data
    }))
}

/** File paths in a tree's display order (pre-order, folders before their
 * children, independent of expand/collapse) — used to publish the targeted
 * list's order for Up/Down navigation (keyboard/targetedOrder.ts). */
export function flattenLeafPaths<T>(nodes: TreeNode<T>[]): string[] {
  const out: string[] = []
  function walk(list: TreeNode<T>[]): void {
    for (const node of list) {
      if (node.isFolder) walk(node.children)
      else out.push(node.path)
    }
  }
  walk(nodes)
  return out
}
