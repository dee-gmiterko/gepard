import { describe, expect, it } from 'vitest';
import { screen, waitFor, within, type BoundFunctions, type queries } from '@testing-library/react';
import App from '../../../src/App';
import { renderWithProviders, type Rendered } from '../../support/render';
import { createWorld } from '../../support/world';

interface FindInFile {
  rendered: Rendered;
  popup: BoundFunctions<typeof queries>;
}

async function openFindInFile(): Promise<FindInFile> {
  const world = createWorld({ files: { 'a.ts': 'foo\nbar foo\nfoo end\nnothing\n' } });
  const rendered = renderWithProviders(<App />, world.handlers);
  const { user } = rendered;

  await user.click(await screen.findByText('a.ts'));
  await waitFor(() => expect(document.querySelector('.cm-editor')).not.toBeNull());
  await user.keyboard('{Control>}f{/Control}');
  const popup = within(await screen.findByRole('dialog', { name: 'Quick search' }));
  await user.type(popup.getByPlaceholderText('Find in file…'), 'foo');
  return { rendered, popup };
}

describe('find in file', () => {
  it('shows the position of the current match among all matches', async () => {
    const { popup } = await openFindInFile();

    expect(await popup.findByText('1 of 3 · Line 1')).toBeVisible();
  });

  it('steps through the matches with the arrow buttons', async () => {
    const { rendered, popup } = await openFindInFile();
    const { user } = rendered;
    await popup.findByText('1 of 3 · Line 1');

    await user.click(popup.getByRole('button', { name: 'Next match' }));
    expect(await popup.findByText('2 of 3 · Line 2')).toBeVisible();
    await user.click(popup.getByRole('button', { name: 'Next match' }));
    expect(await popup.findByText('3 of 3 · Line 3')).toBeVisible();
    await user.click(popup.getByRole('button', { name: 'Next match' }));
    expect(await popup.findByText('1 of 3 · Line 1')).toBeVisible();
    await user.click(popup.getByRole('button', { name: 'Previous match' }));
    expect(await popup.findByText('3 of 3 · Line 3')).toBeVisible();
  });

  it('steps through the matches with the keyboard', async () => {
    const { rendered, popup } = await openFindInFile();
    const { user } = rendered;
    await popup.findByText('1 of 3 · Line 1');

    await user.keyboard('{Enter}');
    expect(await popup.findByText('2 of 3 · Line 2')).toBeVisible();
    await user.keyboard('{ArrowDown}');
    expect(await popup.findByText('3 of 3 · Line 3')).toBeVisible();
    await user.keyboard('{ArrowUp}');
    expect(await popup.findByText('2 of 3 · Line 2')).toBeVisible();
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(await popup.findByText('1 of 3 · Line 1')).toBeVisible();
  });

  it('steps through the matches with F3 and Shift+F3', async () => {
    const { rendered, popup } = await openFindInFile();
    const { user } = rendered;
    await popup.findByText('1 of 3 · Line 1');

    await user.keyboard('{F3}');
    expect(await popup.findByText('2 of 3 · Line 2')).toBeVisible();
    await user.keyboard('{F3}');
    expect(await popup.findByText('3 of 3 · Line 3')).toBeVisible();
    await user.keyboard('{Shift>}{F3}{/Shift}');
    expect(await popup.findByText('2 of 3 · Line 2')).toBeVisible();
  });

  it('disables the arrow buttons when there is nothing to step to', async () => {
    const { rendered, popup } = await openFindInFile();
    const { user } = rendered;
    await popup.findByText('1 of 3 · Line 1');
    expect(popup.getByRole('button', { name: 'Next match' })).toBeEnabled();

    await user.clear(popup.getByPlaceholderText('Find in file…'));
    await user.type(popup.getByPlaceholderText('Find in file…'), 'nothing');
    expect(await popup.findByText('1 of 1 · Line 4')).toBeVisible();
    expect(popup.getByRole('button', { name: 'Next match' })).toBeDisabled();
    expect(popup.getByRole('button', { name: 'Previous match' })).toBeDisabled();
  });
});
