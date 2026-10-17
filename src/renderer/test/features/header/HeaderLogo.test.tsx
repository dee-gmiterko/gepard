import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { HeaderLogo } from '../../../src/features/header/HeaderLogo';
import { renderWithProviders } from '../../support/render';
import { createWorld } from '../../support/world';

describe('header logo', () => {
  it('opens a detached launchpad window on ctrl-click in the desktop host', async () => {
    const { ipc, user } = renderWithProviders(<HeaderLogo />, {
      ...createWorld().handlers,
      'app.launch': () => null,
    });

    await user.keyboard('{Control>}');
    await user.click(await screen.findByRole('button', { name: 'Projects' }));

    expect(ipc.callsTo('app.launch')).toEqual([{ projectId: null, detached: true }]);
  });

  it('never launches a detached window in the browser host', async () => {
    const { ipc, user } = renderWithProviders(
      <HeaderLogo />,
      { ...createWorld().handlers, 'app.launch': () => null },
      { host: 'browser' },
    );

    await user.keyboard('{Control>}');
    await user.click(await screen.findByRole('button', { name: 'Projects' }));

    expect(ipc.callsTo('app.launch')).toEqual([]);
  });
});
