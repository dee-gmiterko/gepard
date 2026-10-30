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

  it('marks all deleted files as viewed', async () => {
    const calls: { paths: string[]; viewed: boolean }[] = [];
    const { user } = renderWithProviders(<MassActions deletedSet={['a.ts', 'b.ts', 'c.ts']} />, {
      ...createWorld({ targeting: { pr: 1 }, prs: [pr(1, 'Change')] }).handlers,
      'viewed.list': () => [],
      'viewed.set': (args: { paths: string[]; viewed: boolean }) => {
        calls.push(args);
        return [];
      },
    });
    expect(
      await screen.findByText('Mark all deleted files as viewed: 2 other files'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark all viewed' }));
    await waitFor(() =>
      expect(calls).toEqual([
        expect.objectContaining({ paths: ['a.ts', 'b.ts', 'c.ts'], viewed: true }),
      ]),
    );
  });
});
