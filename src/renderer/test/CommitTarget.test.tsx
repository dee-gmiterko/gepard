import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import App from '../src/App';
import { renderWithProviders, type Rendered } from './support/render';
import { findOption, optionTexts, settle } from './support/options';
import { commit, createWorld, sha } from './support/world';

const recent = commit(sha('1'), 'Tidy the build');
const older = commit(sha('2'), 'Fix flaky timeout');

function renderApp(): Rendered {
  const world = createWorld({ commits: [recent], searchableCommits: [older] });
  return renderWithProviders(<App />, world.handlers);
}

describe('commit target', () => {
  it('targets a commit from the first page and persists the choice', async () => {
    const { user, ipc } = renderApp();
    const input = await screen.findByPlaceholderText('Commit…');

    await user.click(input);
    await user.click(await findOption('1111111 Tidy the build'));

    expect(input).toHaveValue('1111111 Tidy the build');
    await waitFor(() =>
      expect(ipc.callsTo('projects.setTargeting').at(-1)).toMatchObject({
        targeting: { pr: null, commit: recent.oid },
      }),
    );
    await waitFor(() =>
      expect(ipc.callsTo('pr.checkout').at(-1)).toMatchObject({
        target: { kind: 'commit', sha: recent.oid },
      }),
    );
  });

  it('finds an older commit through the server search', async () => {
    const { user, ipc } = renderApp();
    const input = await screen.findByPlaceholderText('Commit…');

    await user.type(input, 'flaky');

    await waitFor(() => expect(optionTexts()).toEqual(['2222222 Fix flaky timeout']));
    expect(ipc.callsTo('commits.list').map((c) => c.search)).toContain('flaky');
  });

  it('keeps the label of a commit picked from the server search', async () => {
    const { user } = renderApp();
    const input = await screen.findByPlaceholderText('Commit…');

    await user.type(input, 'flaky');
    await user.click(await findOption('2222222 Fix flaky timeout'));

    await settle();
    expect(input).toHaveValue('2222222 Fix flaky timeout');
  });
});
