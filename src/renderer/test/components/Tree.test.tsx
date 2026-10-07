import { useMemo, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Tree } from '../../src/components/Tree';
import { rowsByPath } from '../../src/helpers/row';
import { buildTree, withRoot } from '../../src/helpers/tree';
import { renderWithProviders } from '../support/render';
import { createWorld } from '../support/world';

const changed = [
  { path: 'src/a.ts', additions: 1, deletions: 0 },
  { path: 'src/b.ts', additions: 2, deletions: 0 },
  { path: 'README.md', additions: 3, deletions: 0 },
];

function Harness(): React.JSX.Element {
  const [viewed, setViewed] = useState<{ path: string; viewed: boolean }[]>([]);
  const nodes = useMemo(() => withRoot(buildTree(changed.map((f) => f.path)), 'gepard'), []);
  const rows = useMemo(() => rowsByPath(changed, viewed), [viewed]);
  return (
    <>
      <button type="button" onClick={() => setViewed([{ path: 'src/a.ts', viewed: true }])}>
        mark a.ts viewed
      </button>
      <Tree<null>
        nodes={nodes}
        renderFile={(node) => (
          <span>
            {node.name} {rows.get(node.path)?.viewedCount}/{rows.get(node.path)?.totalCount}
          </span>
        )}
        renderFolder={(node) => (
          <span data-testid={`folder-${node.path}`}>{rows.get(node.path)?.viewedCount}</span>
        )}
      />
    </>
  );
}

describe('Tree', () => {
  it('updates row data on a viewed toggle', async () => {
    const { user } = renderWithProviders(<Harness />, createWorld().handlers);
    expect(await screen.findByText('a.ts 0/1')).toBeInTheDocument();
    expect(screen.getByTestId('folder-src')).toHaveTextContent('0');

    await user.click(screen.getByRole('button', { name: 'mark a.ts viewed' }));

    expect(screen.getByText('a.ts 1/1')).toBeInTheDocument();
    expect(screen.getByText('b.ts 0/1')).toBeInTheDocument();
    expect(screen.getByTestId('folder-src')).toHaveTextContent('1');
  });

  it('moves between visible rows with the arrow keys and collapses folders', async () => {
    const { user } = renderWithProviders(<Harness />, createWorld().handlers);
    const items = await screen.findAllByRole('treeitem');
    expect(items.map((i) => i.tabIndex)).toEqual([0, -1, -1, -1, -1]);
    expect(items[2]).toHaveAttribute('aria-level', '3');
    expect(items[3]).toHaveAttribute('aria-posinset', '2');
    expect(items[3]).toHaveAttribute('aria-setsize', '2');

    items[0].focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('treeitem')[1]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('treeitem')[2]).toHaveTextContent('a.ts');
    expect(screen.getAllByRole('treeitem')[2]).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getAllByRole('treeitem')[1]).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getAllByRole('treeitem')[1]).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('treeitem')).toHaveLength(3);

    await user.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('treeitem')[2]).toHaveTextContent('README.md');
    expect(screen.getAllByRole('treeitem')[2]).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowRight}');
    expect(screen.getAllByRole('treeitem')).toHaveLength(5);
  });
});
