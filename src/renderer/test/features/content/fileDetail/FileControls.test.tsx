import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { FileControls } from '../../../../src/features/content/fileDetail/FileControls';
import { ContextMenu } from '../../../../src/features/contextMenu/ContextMenu';
import { renderWithProviders } from '../../../support/render';
import { createWorld } from '../../../support/world';

const handlers = { ...createWorld().handlers, 'contextMenu.showFileView': () => null };

describe('FileControls view options', () => {
  it('opens the in-page menu without IPC in the browser host', async () => {
    const { ipc, user } = renderWithProviders(
      <>
        <FileControls />
        <ContextMenu />
      </>,
      handlers,
      { host: 'browser' },
    );
    await user.click(await screen.findByRole('button', { name: 'View options' }));
    expect(ipc.callsTo('contextMenu.showFileView')).toEqual([]);
    expect(screen.getByRole('menuitemcheckbox', { name: 'Wrap long lines' })).toBeInTheDocument();
  });

  it('asks the native menu through IPC in the desktop host', async () => {
    const { ipc, user } = renderWithProviders(<FileControls />, handlers);
    await user.click(await screen.findByRole('button', { name: 'View options' }));
    expect(ipc.callsTo('contextMenu.showFileView')).toHaveLength(1);
  });
});
