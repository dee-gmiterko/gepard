import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { ReviewerRow } from '../../../../src/features/content/overview/pr/ReviewerRow';
import { renderWithProviders } from '../../../support/render';
import { createWorld } from '../../../support/world';

describe('ReviewerRow', () => {
  it('keeps its only cell at the start of the row', async () => {
    renderWithProviders(<ReviewerRow name="alice">Approved</ReviewerRow>, createWorld().handlers);

    const cell = (await screen.findByText('alice')).parentElement as HTMLElement;
    expect(getComputedStyle(cell).justifySelf).not.toBe('end');
  });
});
