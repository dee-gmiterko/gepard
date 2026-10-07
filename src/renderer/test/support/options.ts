import { screen, waitFor } from '@testing-library/react';

export function optionTexts(): string[] {
  return screen.queryAllByRole('option').map((el) => el.textContent ?? '');
}

export async function findOption(label: string): Promise<HTMLElement> {
  return waitFor(() => {
    const found = screen.queryAllByRole('option').find((el) => el.textContent === label);
    if (!found) throw new Error(`option "${label}" not shown, have: ${optionTexts().join(' | ')}`);
    return found;
  });
}

export const DEBOUNCE_SETTLE_MS = 400;

export function settle(ms = DEBOUNCE_SETTLE_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function first<T>(items: readonly T[]): T {
  const [head] = items;
  if (head === undefined) throw new Error('expected at least one element');
  return head;
}
