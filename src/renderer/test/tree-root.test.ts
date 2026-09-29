import { describe, expect, it } from 'vitest';
import { buildTree, withRoot } from '../src/components/Tree/buildTree';

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

describe('withRoot', () => {
  const entries = buildTree(
    [
      { path: 'src/a.ts', data: 1 },
      { path: 'src/b.ts', data: 2 },
      { path: 'README.md', data: 4 },
    ],
    { aggregateFolder: sum },
  );

  it('wraps the top-level entries in one folder named after the project', () => {
    const [root, ...rest] = withRoot(entries, 'gepard', { aggregateFolder: sum });
    expect(rest).toEqual([]);
    expect(root.name).toBe('gepard');
    expect(root.path).toBe('');
    expect(root.isFolder).toBe(true);
    expect(root.children).toBe(entries);
    expect(root.children.map((n) => n.name)).toEqual(['src', 'README.md']);
  });

  it('aggregates the root data from its children', () => {
    const [root] = withRoot(entries, 'gepard', { aggregateFolder: sum });
    expect(root.data).toBe(7);
  });

  it('leaves data undefined without an aggregator', () => {
    const [root] = withRoot(entries, 'gepard');
    expect(root.data).toBeUndefined();
  });
});
