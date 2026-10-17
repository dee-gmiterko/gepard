import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { ContextMenu } from '../../../src/features/contextMenu/ContextMenu';
import { useUiDispatch } from '../../../src/state/UiContext';
import { useLayout } from '../../../src/state/hooks';
import { renderWithProviders, type Rendered } from '../../support/render';
import { createWorld } from '../../support/world';

const execCommand = vi.fn<(command: string) => boolean>(() => true);
const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());

function Harness(): React.JSX.Element {
  const dispatch = useUiDispatch();
  const layout = useLayout();
  return (
    <>
      <textarea aria-label="Notes" />
      <p>Outside</p>
      <button
        onClick={() =>
          dispatch({
            type: 'contextMenu/open',
            menu: { kind: 'fileView', x: 5, y: 6, ...layout },
          })
        }
      >
        View options
      </button>
      <button
        onClick={() =>
          dispatch({ type: 'contextMenu/setLineTarget', target: { path: 'a.ts', line: 3 } })
        }
      >
        Target line
      </button>
      <output>{layout.wrapLongLines ? 'wrapped' : 'unwrapped'}</output>
      <ContextMenu />
    </>
  );
}

function renderMenu(): Rendered {
  const rendered = renderWithProviders(<Harness />, createWorld().handlers, { host: 'browser' });
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return rendered;
}

describe('ContextMenu', () => {
  beforeEach(() => {
    execCommand.mockClear();
    writeText.mockClear();
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
  });

  it('opens at the pointer for an editable target', async () => {
    renderMenu();
    fireEvent.contextMenu(await screen.findByLabelText('Notes'), { clientX: 30, clientY: 40 });
    expect(screen.getByRole('menu')).toHaveStyle({ left: '30px', top: '40px' });
    expect(screen.getByRole('menuitem', { name: 'Paste' })).toBeInTheDocument();
  });

  it('leaves the native menu for non-editable text without selection', async () => {
    renderMenu();
    fireEvent.contextMenu(await screen.findByText('Outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('runs the picked command and closes', async () => {
    const { user } = renderMenu();
    fireEvent.contextMenu(await screen.findByLabelText('Notes'));
    await user.click(screen.getByRole('menuitem', { name: 'Select all' }));
    expect(execCommand).toHaveBeenCalledWith('selectAll');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('does not run disabled entries', async () => {
    const { user } = renderMenu();
    fireEvent.contextMenu(await screen.findByLabelText('Notes'));
    await user.click(screen.getByRole('menuitem', { name: 'Cut' }));
    expect(execCommand).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('offers line copy entries for a line target and consumes the target', async () => {
    const { user } = renderMenu();
    await user.click(await screen.findByRole('button', { name: 'Target line' }));
    fireEvent.contextMenu(screen.getByText('Outside'));
    await user.click(screen.getByRole('menuitem', { name: 'Copy line reference' }));
    expect(writeText).toHaveBeenCalledWith('a.ts:3');
    fireEvent.contextMenu(screen.getByText('Outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on Escape and on an outside click', async () => {
    const { user } = renderMenu();
    fireEvent.contextMenu(await screen.findByLabelText('Notes'));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getByLabelText('Notes'));
    await user.click(screen.getByText('Outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('toggles a file view option and reflects its state', async () => {
    const { user } = renderMenu();
    await user.click(await screen.findByRole('button', { name: 'View options' }));
    const wrap = screen.getByRole('menuitemcheckbox', { name: 'Wrap long lines' });
    expect(wrap).toHaveAttribute('aria-checked', 'false');
    await user.click(wrap);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(await screen.findByText('wrapped')).toBeInTheDocument();
  });
});

describe('ContextMenu placement', () => {
  it('shifts back inside the viewport using the measured panel size', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true });
    const measure = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ width: 160, height: 120 } as DOMRect);
    renderMenu();
    fireEvent.contextMenu(await screen.findByLabelText('Notes'), { clientX: 480, clientY: 390 });
    expect(screen.getByRole('menu')).toHaveStyle({ left: '336px', top: '276px' });
    measure.mockRestore();
  });
});
