import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { LocalViewedState } from '@gepard/common';
import App from '../../../../src/App';
import { settle } from '../../../support/options';
import { renderWithProviders } from '../../../support/render';
import { createWorld, pr } from '../../../support/world';

describe('toggling Viewed', () => {
  it('keeps the same CodeMirror editor instance', async () => {
    const viewed: LocalViewedState[] = [];
    const world = createWorld({
      targeting: { pr: 7 },
      prs: [pr(7, 'Rework a.ts')],
      files: { 'a.ts': 'const a = 1;\n' },
    });
    const handlers = {
      ...world.handlers,
      'viewed.list': () => viewed,
      'viewed.set': ({ paths, viewed: value }: { paths: string[]; viewed: boolean }) => {
        for (const path of paths) {
          viewed.splice(0, viewed.length, ...viewed.filter((v) => v.path !== path));
          viewed.push({
            prId: 'PR_7',
            path,
            viewed: value,
            remote: null,
            localUpdatedAt: null,
            remoteFetchedAt: null,
            viewedSha: null,
          });
        }
        return viewed;
      },
    };
    const { user } = renderWithProviders(<App />, handlers);
    await user.click(await screen.findByText('a.ts'));
    const editor = await waitFor(() => {
      const dom = document.querySelector('.cm-editor');
      if (!dom) throw new Error('editor not mounted');
      return dom;
    });

    const [toggle] = await screen.findAllByRole('checkbox', { name: 'Viewed' });
    await user.click(toggle);
    await waitFor(() => expect(viewed).toHaveLength(1));
    await waitFor(() =>
      expect(screen.getAllByRole('checkbox', { name: 'Viewed' })[0]).toBeChecked(),
    );
    await settle(100);

    expect(document.querySelector('.cm-editor')).toBe(editor);
  });
});
