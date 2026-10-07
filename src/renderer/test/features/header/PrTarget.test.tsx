import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import App from '../../../src/App';
import { renderWithProviders, type Rendered } from '../../support/render';
import { findOption, settle } from '../../support/options';
import { createWorld, pr } from '../../support/world';

const open = pr(7, 'Speed up the indexer');
const found = pr(42, 'Add feature flags');

function renderApp(): Rendered {
  const world = createWorld({ prs: [open], searchablePrs: [found] });
  return renderWithProviders(<App />, world.handlers);
}

describe('pull request target', () => {
  it('targets a listed pull request, persists it and checks it out', async () => {
    const { user, ipc } = renderApp();
    const input = await screen.findByPlaceholderText('PR…');

    await user.click(input);
    await user.click(await findOption('#7 Speed up the indexer'));

    expect(input).toHaveValue('#7 Speed up the indexer');
    await waitFor(() =>
      expect(ipc.callsTo('projects.setTargeting').at(-1)).toMatchObject({
        targeting: { pr: 7, commit: null },
      }),
    );
    await waitFor(() =>
      expect(ipc.callsTo('pr.checkout').at(-1)).toMatchObject({
        target: { kind: 'pr', pr: 7 },
      }),
    );
  });

  it('keeps the title of a pull request picked from the server search', async () => {
    const { user } = renderApp();
    const input = await screen.findByPlaceholderText('PR…');

    await user.type(input, 'flags');
    await user.click(await findOption('#42 Add feature flags'));

    await settle();
    expect(input).toHaveValue('#42 Add feature flags');
  });
});
