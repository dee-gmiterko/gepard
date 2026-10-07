import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Modal } from '../src/components/Modal';
import { renderWithProviders, type Rendered } from './support/render';
import { createWorld } from './support/world';

function ModalHost({ closes }: { closes: string[] }): React.JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <>
      {open && (
        <Modal
          title="Rename project"
          closeLabel="Close dialog"
          onClose={() => {
            closes.push('close');
            setOpen(false);
          }}
        >
          <p>Dialog body</p>
        </Modal>
      )}
    </>
  );
}

function renderModal(): Rendered & { closes: string[] } {
  const closes: string[] = [];
  const rendered = renderWithProviders(<ModalHost closes={closes} />, createWorld().handlers);
  return { ...rendered, closes };
}

describe('Modal', () => {
  it('opens as a modal dialog with its title and body', async () => {
    renderModal();

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveTextContent('Rename project');
    expect(dialog).toHaveTextContent('Dialog body');
  });

  it('closes once from the close button', async () => {
    const { user, closes } = renderModal();

    await user.click(await screen.findByRole('button', { name: 'Close dialog' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(closes).toEqual(['close']);
  });

  it('closes once from a click on the backdrop', async () => {
    const { user, closes } = renderModal();
    const dialog = await screen.findByRole('dialog');

    await user.pointer({ keys: '[MouseLeft>]', target: dialog });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(closes).toEqual(['close']);
  });
});
