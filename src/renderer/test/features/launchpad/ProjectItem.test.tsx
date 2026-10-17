import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { ProjectItem } from '../../../src/features/launchpad/ProjectItem';
import { renderWithProviders, type Rendered } from '../../support/render';
import { createWorld } from '../../support/world';

const project = {
  id: 'p1',
  url: 'https://github.com/acme/widgets',
  owner: 'acme',
  repo: 'widgets',
  addedAt: '2026-01-01T00:00:00.000Z',
  cloned: true,
};

function renderItem(host: 'desktop' | 'browser'): Rendered {
  return renderWithProviders(
    <ProjectItem project={project} autoClone={false} />,
    { ...createWorld().handlers, 'app.launch': () => new Promise(() => undefined) },
    { host },
  );
}

async function ctrlClickProject(user: Rendered['user']): Promise<void> {
  await user.keyboard('{Control>}');
  await user.click(await screen.findByText('acme/widgets'));
}

describe('project item open', () => {
  it('launches a detached window on ctrl-click in the desktop host', async () => {
    const { ipc, user } = renderItem('desktop');

    await ctrlClickProject(user);

    expect(ipc.callsTo('app.launch')).toEqual([{ projectId: 'p1', detached: true }]);
    expect(await screen.findByText('Opening in a new window…')).toBeVisible();
  });

  it('launches in the same window and shows no launching state on ctrl-click in the browser host', async () => {
    const { ipc, user } = renderItem('browser');

    await ctrlClickProject(user);

    expect(ipc.callsTo('app.launch')).toEqual([{ projectId: 'p1', detached: false }]);
    expect(screen.queryByText('Opening in a new window…')).toBeNull();
  });
});
