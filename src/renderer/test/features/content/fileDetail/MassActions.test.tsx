import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { MassActions } from '../../../../src/features/content/fileDetail/massActions/MassActions';
import { renderWithProviders } from '../../../support/render';
import { createWorld, pr } from '../../../support/world';

describe('MassActions', () => {
  it('renders nothing without any set', () => {
    const { container } = renderWithProviders(<MassActions />, createWorld().handlers);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ['deletedSet', 'Full file removals: 2 other files'],
    ['removedSet', 'Removals only: 2 other files'],
  ] as const)('marks the %s files as viewed', async (prop, title) => {
    const calls: { paths: string[]; viewed: boolean }[] = [];
    const { user } = renderWithProviders(
      <MassActions {...{ [prop]: ['a.ts', 'b.ts', 'c.ts'] }} />,
      {
        ...createWorld({ targeting: { pr: 1 }, prs: [pr(1, 'Change')] }).handlers,
        'viewed.list': () => [],
        'viewed.set': (args: { paths: string[]; viewed: boolean }) => {
          calls.push(args);
          return [];
        },
      },
    );
    expect(await screen.findByText(title)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark all viewed' }));
    await waitFor(() =>
      expect(calls).toEqual([
        expect.objectContaining({ paths: ['a.ts', 'b.ts', 'c.ts'], viewed: true }),
      ]),
    );
  });

  it('shows both rows independently', async () => {
    renderWithProviders(
      <MassActions deletedSet={['a.ts', 'b.ts']} removedSet={['a.ts', 'c.ts', 'd.ts']} />,
      {
        ...createWorld({ targeting: { pr: 1 }, prs: [pr(1, 'Change')] }).handlers,
        'viewed.list': () => [],
      },
    );
    expect(await screen.findByText('Full file removals: 1 other file')).toBeInTheDocument();
    expect(screen.getByText('Removals only: 2 other files')).toBeInTheDocument();
  });
});
