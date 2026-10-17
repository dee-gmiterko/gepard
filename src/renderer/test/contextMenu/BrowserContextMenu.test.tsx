import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { BrowserContextMenu } from '../../src/contextMenu/BrowserContextMenu';
import { renderWithProviders, type Rendered } from '../support/render';
import { createWorld } from '../support/world';

const execCommand = vi.fn<(command: string) => boolean>(() => true);

function renderMenu(host: 'desktop' | 'browser'): Rendered {
  return renderWithProviders(
    <>
      <textarea aria-label="Notes" />
      <p>Outside</p>
      <BrowserContextMenu />
    </>,
    createWorld().handlers,
    { host },
  );
}

describe('BrowserContextMenu', () => {
  beforeEach(() => {
    execCommand.mockClear();
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
  });

  it('opens at the pointer on contextmenu in the browser host', async () => {
    renderMenu('browser');
    fireEvent.contextMenu(await screen.findByLabelText('Notes'), { clientX: 30, clientY: 40 });
    const menu = screen.getByRole('menu');
    expect(menu).toHaveStyle({ left: '30px', top: '40px' });
    expect(screen.getByRole('menuitem', { name: 'Select all' })).toBeInTheDocument();
  });

  it('fires the selected entry and closes', async () => {
    const { user } = renderMenu('browser');
    fireEvent.contextMenu(await screen.findByLabelText('Notes'));
    await user.click(screen.getByRole('menuitem', { name: 'Select all' }));
    expect(execCommand).toHaveBeenCalledWith('selectAll');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const { user } = renderMenu('browser');
    fireEvent.contextMenu(await screen.findByLabelText('Notes'));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on an outside click', async () => {
    const { user } = renderMenu('browser');
    fireEvent.contextMenu(await screen.findByLabelText('Notes'));
    await user.click(screen.getByText('Outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('does nothing on the desktop host', async () => {
    renderMenu('desktop');
    fireEvent.contextMenu(await screen.findByLabelText('Notes'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
