import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Combobox } from '../../src/components/Combobox';
import { findOption, optionTexts } from '../support/options';
import { renderWithProviders, type Rendered } from '../support/render';
import { createWorld } from '../support/world';

interface Fruit {
  id: string;
  name: string;
}

const fruits: Fruit[] = [
  { id: 'a', name: 'Apple' },
  { id: 'b', name: 'Banana' },
  { id: 'c', name: 'Cherry' },
];

function FruitPicker({ selections }: { selections: (Fruit | null)[] }): React.JSX.Element {
  const [value, setValue] = useState<Fruit | null>(null);
  return (
    <Combobox<Fruit>
      items={fruits}
      value={value}
      getKey={(f) => f.id}
      getLabel={(f) => f.name}
      placeholder="Fruit"
      onSelect={(fruit) => {
        selections.push(fruit);
        setValue(fruit);
      }}
    />
  );
}

function renderPicker(): Rendered & { selections: (Fruit | null)[] } {
  const selections: (Fruit | null)[] = [];
  const rendered = renderWithProviders(
    <FruitPicker selections={selections} />,
    createWorld().handlers,
  );
  return { ...rendered, selections };
}

describe('Combobox', () => {
  it('filters the options by the typed text and selects one with the mouse', async () => {
    const { user, selections } = renderPicker();
    const input = await screen.findByRole('combobox');

    await user.type(input, 'an');
    expect(optionTexts()).toEqual(['Banana']);

    await user.click(await findOption('Banana'));

    expect(selections).toEqual([fruits[1]]);
    expect(input).toHaveValue('Banana');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('highlights with ArrowDown and selects the highlighted option with Enter', async () => {
    const { user, selections } = renderPicker();
    const input = await screen.findByRole('combobox');

    await user.click(input);
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(await findOption('Banana')).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Enter}');

    expect(selections).toEqual([fruits[1]]);
    expect(input).toHaveValue('Banana');
  });

  it('clears the selection with the clear button', async () => {
    const { user, selections } = renderPicker();
    const input = await screen.findByRole('combobox');
    await user.click(input);
    await user.click(await findOption('Apple'));

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(selections).toEqual([fruits[0], null]);
    expect(input).toHaveValue('');
  });

  it('does not select a hidden option with Enter after Escape closed the list', async () => {
    const { user, selections } = renderPicker();
    const input = await screen.findByRole('combobox');

    await user.click(input);
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    await user.keyboard('{Enter}');

    expect(selections).toEqual([]);
  });
});
