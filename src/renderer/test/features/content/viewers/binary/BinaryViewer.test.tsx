import { describe, expect, it } from 'vitest';
import { screen, within, type BoundFunctions, type queries } from '@testing-library/react';
import App from '../../../../../src/App';
import { renderWithProviders } from '../../../../support/render';
import { createWorld, pr } from '../../../../support/world';

function facts(): BoundFunctions<typeof queries> {
  const heading = screen.getByRole('heading', { name: /Binary file/ });
  const card = heading.parentElement;
  if (!card) throw new Error('binary panel is not rendered');
  return within(card);
}

describe('binary file view', () => {
  it('shows the path and size of a binary file', async () => {
    const world = createWorld({ files: { 'app.zip': '' } });
    const { user } = renderWithProviders(<App />, {
      ...world.handlers,
      'files.content': ({ path, sha }) => ({ kind: 'binary', path, sha, size: 1536 }),
    });

    await user.click(await screen.findByText('app.zip'));

    expect(await screen.findByRole('heading', { name: 'Binary file' })).toBeVisible();
    const panel = facts();
    expect(panel.getByText('app.zip')).toBeVisible();
    expect(panel.getByText('1.5 kB')).toHaveAttribute('title', '1,536 bytes');
  });

  it('omits the size when it was not reported', async () => {
    const world = createWorld({ files: { blob: '' } });
    const { user } = renderWithProviders(<App />, {
      ...world.handlers,
      'files.content': ({ path, sha }) => ({ kind: 'binary', path, sha }),
    });

    await user.click(await screen.findByText('blob'));

    expect(await screen.findByRole('heading', { name: 'Binary file' })).toBeVisible();
    expect(facts().queryByText('Size')).not.toBeInTheDocument();
  });
});

describe('binary diff view', () => {
  it('shows the size on both sides with the delta', async () => {
    const world = createWorld({
      targeting: { pr: 7 },
      prs: [pr(7, 'Update the archive')],
      files: { 'app.zip': '' },
    });
    const { user } = renderWithProviders(<App />, {
      ...world.handlers,
      'files.diff': ({ path }) => ({
        kind: 'binary',
        path,
        previousPath: null,
        oldSize: 1000,
        newSize: 1500,
      }),
    });

    await user.click(await screen.findByText('app.zip'));

    expect(await screen.findByRole('heading', { name: 'Binary file changed' })).toBeVisible();
    const panel = facts();
    expect(panel.getByText('1 kB')).toBeVisible();
    expect(panel.getByText('1.5 kB')).toBeVisible();
    expect(panel.getByText('+500 bytes')).toBeVisible();
  });

  it('shows a deleted binary file without a size after', async () => {
    const world = createWorld({
      targeting: { pr: 7 },
      prs: [pr(7, 'Drop the archive')],
      files: { 'archive.tar.gz': '' },
    });
    const { user } = renderWithProviders(<App />, {
      ...world.handlers,
      'files.diff': ({ path }) => ({
        kind: 'binary',
        path,
        previousPath: null,
        oldSize: 2_000_000,
        newSize: null,
      }),
    });

    await user.click(await screen.findByText('archive.tar.gz'));

    expect(await screen.findByRole('heading', { name: 'Binary file changed' })).toBeVisible();
    const panel = facts();
    expect(panel.getByText('2 MB')).toBeVisible();
    expect(panel.getByText('No file')).toBeVisible();
    expect(panel.getByText('-2 MB')).toBeVisible();
  });

  it('shows the previous path of a renamed binary file', async () => {
    const world = createWorld({
      targeting: { pr: 7 },
      prs: [pr(7, 'Move the font')],
      files: { 'Inter.woff2': '' },
    });
    const { user } = renderWithProviders(<App />, {
      ...world.handlers,
      'files.diff': ({ path }) => ({ kind: 'binary', path, previousPath: 'old.woff2' }),
    });

    await user.click(await screen.findByText('Inter.woff2'));

    expect(await screen.findByRole('heading', { name: 'Binary file changed' })).toBeVisible();
    const panel = facts();
    expect(panel.getByText('Previous path')).toBeVisible();
    expect(panel.getByText('old.woff2')).toBeVisible();
    expect(panel.queryByText('Size before')).not.toBeInTheDocument();
  });
});

describe('moved file view', () => {
  it('shows the move message above the size of a moved binary file without a diff', async () => {
    const world = createWorld({
      targeting: { pr: 7 },
      prs: [pr(7, 'Move the font')],
      files: { 'Inter.woff2': '' },
    });
    const { user } = renderWithProviders(<App />, {
      ...world.handlers,
      'files.diff': ({ path }) => ({
        kind: 'binary',
        path,
        previousPath: 'old.woff2',
        oldSize: 1500,
        newSize: 1500,
        moved: true,
      }),
    });

    await user.click(await screen.findByText('Inter.woff2'));

    expect(await screen.findByText(/File renamed without changes\./)).toBeVisible();
    expect(screen.getByText(/old\.woff2 → Inter\.woff2/)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Binary file' })).toBeVisible();
    expect(screen.getByText('1.5 kB')).toBeVisible();
    expect(screen.queryByText('Size before')).not.toBeInTheDocument();
  });

  it('shows the image once below the move message for a moved image', async () => {
    const world = createWorld({
      targeting: { pr: 7 },
      prs: [pr(7, 'Move the logo')],
      files: { 'logo.png': '' },
    });
    const { user } = renderWithProviders(<App />, {
      ...world.handlers,
      'files.diff': ({ path }) => ({
        kind: 'image',
        path,
        previousPath: 'old.png',
        before: { mime: 'image/png', base64: 'AAAA' },
        after: { mime: 'image/png', base64: 'AAAA' },
        moved: true,
      }),
    });

    await user.click(await screen.findByText('logo.png'));

    expect(await screen.findByText(/File renamed without changes\./)).toBeVisible();
    expect(screen.getAllByRole('img', { name: 'logo.png' })).toHaveLength(1);
    expect(screen.queryByText('Before')).not.toBeInTheDocument();
  });
});
