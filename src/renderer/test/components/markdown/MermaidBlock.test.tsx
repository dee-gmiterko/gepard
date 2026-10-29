import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Markdown } from '../../../src/components/markdown';
import { renderWithProviders, type Rendered } from '../../support/render';
import { createWorld } from '../../support/world';

const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  parse: vi.fn(),
  render: vi.fn(),
}));
vi.mock('mermaid', () => ({ default: mermaid }));

function show(text: string): Rendered {
  return renderWithProviders(<Markdown>{text}</Markdown>, createWorld().handlers);
}

describe('mermaid fences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mermaid.parse.mockResolvedValue(true);
    mermaid.render.mockResolvedValue({ svg: '<svg data-testid="diagram"></svg>' });
  });

  it('renders the diagram svg', async () => {
    show('```mermaid\ngraph TD; A-->B\n```');
    expect(await screen.findByTestId('diagram')).toBeTruthy();
    expect(mermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: 'strict', startOnLoad: false, theme: 'base' }),
    );
  });

  it('falls back to code and an error line when rendering fails', async () => {
    mermaid.render.mockRejectedValue(new Error('boom'));
    show('```mermaid\ngraph TD; A-->B1\n```');
    expect(await screen.findByText('Could not render diagram: boom')).toBeTruthy();
    expect(screen.getByText('graph TD; A-->B1').closest('pre')).toBeTruthy();
  });

  it('falls back to code when the syntax is invalid', async () => {
    mermaid.parse.mockResolvedValue(false);
    show('```mermaid\nnot a diagram\n```');
    expect(await screen.findByText(/invalid diagram syntax/)).toBeTruthy();
    expect(mermaid.render).not.toHaveBeenCalled();
    expect(screen.getByText('not a diagram').closest('pre')).toBeTruthy();
  });

  it('leaves other fences alone', async () => {
    show('```ts\nconst a = 1\n```');
    expect((await screen.findByText('const a = 1')).closest('pre')).toBeTruthy();
    expect(mermaid.initialize).not.toHaveBeenCalled();
  });
});
