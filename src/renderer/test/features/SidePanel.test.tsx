import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { SidePanel } from '../../src/features/sidePanel/SidePanel';
import { renderWithProviders } from '../support/render';
import { createWorld } from '../support/world';

describe('SidePanel tabs', () => {
  it('shows the files tab by default', async () => {
    renderWithProviders(<SidePanel />, createWorld().handlers);

    const tab = await screen.findByRole('tab', { name: 'File browser' });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'File browser' })).toBeVisible();
  });

  it('closes the content when the active tab is clicked and reopens it on any tab', async () => {
    const { user } = renderWithProviders(<SidePanel />, createWorld().handlers);
    const files = await screen.findByRole('tab', { name: 'File browser' });

    await user.click(files);
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveAttribute('aria-selected', 'false');
    }
    expect(screen.queryByRole('tabpanel')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Search' }));
    expect(screen.getByRole('tab', { name: 'Search' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Search' })).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Search' }));
    await user.click(screen.getByRole('tab', { name: 'Search' }));
    expect(screen.getByRole('tabpanel', { name: 'Search' })).toBeVisible();
  });
});
