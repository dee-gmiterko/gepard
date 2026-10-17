import { describe, expect, it } from 'vitest';
import type { CatalogEntryStatus, ExtensionInfo } from '@gepard/common';
import { screen, within } from '@testing-library/react';
import { SettingsOverlay } from '../../../src/features/settings/SettingsOverlay';
import { renderWithProviders, type Rendered } from '../../support/render';
import { createWorld } from '../../support/world';

function entry(name: string, installedVersion: string | null): CatalogEntryStatus {
  return {
    name,
    displayName: name,
    kind: 'theme',
    description: `${name} description`,
    repository: 'owner/repo',
    path: name,
    sha: 'abc',
    supported: true,
    installedVersion,
    installedSource: null,
  };
}

function renderOverlay(): Rendered {
  const world = createWorld();
  world.handlers['extensions.catalog'] = () => ({
    entries: [entry('fresh-theme', null), entry('old-theme', '1.0.0')],
  });
  world.handlers['extensions.dir'] = () => '/tmp/extensions';
  return renderWithProviders(<SettingsOverlay onClose={() => undefined} />, world.handlers);
}

describe('SettingsOverlay', () => {
  it('shows one screen at a time, starting with general settings', async () => {
    renderOverlay();

    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((tab) => tab.getAttribute('aria-label'))).toEqual([
      'General',
      'Controls',
      'Extensions',
    ]);
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('General');
    expect(screen.queryByText('Install from GitHub')).toBeNull();
  });

  it('switches screens by clicking a tab', async () => {
    const { user } = renderOverlay();

    await user.click(await screen.findByRole('tab', { name: 'Controls' }));

    expect(screen.getByRole('tab', { name: 'Controls' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Controls');
  });

  it('shows theme and language settings on the same tab', async () => {
    renderOverlay();

    const panel = await screen.findByRole('tabpanel');
    expect(within(panel).getByRole('heading', { name: 'Theme' })).toBeVisible();
    expect(within(panel).getByRole('heading', { name: 'Language' })).toBeVisible();
  });

  it('disables the toggle of the last enabled theme and locale only', async () => {
    const world = createWorld();
    const ext = (
      id: string,
      kind: 'theme' | 'locale' | 'lsp',
      enabled: boolean,
    ): ExtensionInfo => ({
      id,
      displayName: id,
      kind,
      source: { kind: 'builtin' as const },
      enabled,
    });
    world.handlers['extensions.list'] = () => [
      ext('light', 'theme', true),
      ext('dark', 'theme', false),
      ext('en', 'locale', true),
      ext('sk', 'locale', true),
      ext('lang', 'lsp', true),
    ];
    world.handlers['extensions.catalog'] = () => ({ entries: [] });
    world.handlers['extensions.dir'] = () => '/tmp/extensions';
    const { user } = renderWithProviders(
      <SettingsOverlay onClose={() => undefined} />,
      world.handlers,
    );

    await user.click(await screen.findByRole('tab', { name: 'Extensions' }));

    expect(await screen.findByRole('checkbox', { name: 'Enable light' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Enable dark' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'Enable en' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'Enable sk' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'Enable lang' })).toBeEnabled();
  });

  it('moves between tabs with the arrow, Home and End keys', async () => {
    const { user } = renderOverlay();

    const general = await screen.findByRole('tab', { name: 'General' });
    general.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('tab', { name: 'Controls' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Controls' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Extensions' })).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('tab', { name: 'General' })).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('tab', { name: 'Extensions' })).toHaveFocus();

    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'General' })).toHaveFocus();
  });

  it('keeps only the selected tab in the tab order', async () => {
    renderOverlay();

    expect(await screen.findByRole('tab', { name: 'General' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Controls' })).toHaveAttribute('tabindex', '-1');
  });

  it('lists only not-yet-installed extensions next to the installed ones, with the repository install on top', async () => {
    const { user } = renderOverlay();

    await user.click(await screen.findByRole('tab', { name: 'Extensions' }));

    const panel = screen.getByRole('tabpanel');
    expect(await within(panel).findByText('fresh-theme')).toBeVisible();
    expect(within(panel).queryByText('old-theme')).toBeNull();
    expect(within(panel).getByRole('heading', { name: 'Install from GitHub' })).toBeVisible();
    expect(within(panel).getByRole('heading', { name: 'Available extensions' })).toBeVisible();
    expect(within(panel).getByRole('heading', { name: 'Installed extensions' })).toBeVisible();

    const headings = within(panel)
      .getAllByRole('heading')
      .map((heading) => heading.textContent);
    expect(headings.indexOf('Install from GitHub')).toBeLessThan(
      headings.indexOf('Available extensions'),
    );
  });
});
