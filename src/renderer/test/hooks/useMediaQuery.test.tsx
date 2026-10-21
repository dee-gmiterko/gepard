import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMediaQuery } from '../../src/hooks/useMediaQuery';

function fakeMatchMedia(matches: boolean): {
  lists: Map<string, { matches: boolean; listeners: Set<() => void> }>;
  setMatches: (query: string, next: boolean) => void;
} {
  const lists = new Map<string, { matches: boolean; listeners: Set<() => void> }>();
  vi.stubGlobal('matchMedia', (query: string) => {
    const list = lists.get(query) ?? { matches, listeners: new Set<() => void>() };
    lists.set(query, list);
    return {
      get matches() {
        return list.matches;
      },
      addEventListener: (_: string, fn: () => void) => list.listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => list.listeners.delete(fn),
    };
  });
  return {
    lists,
    setMatches: (query, next) => {
      const list = lists.get(query);
      if (!list) return;
      list.matches = next;
      for (const fn of list.listeners) fn();
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('useMediaQuery', () => {
  it('reports the current match and follows changes', () => {
    const media = fakeMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(max-width: 900px)'));
    expect(result.current).toBe(false);
    act(() => media.setMatches('(max-width: 900px)', true));
    expect(result.current).toBe(true);
  });

  it('stops listening on unmount', () => {
    const media = fakeMatchMedia(true);
    const { unmount } = renderHook(() => useMediaQuery('(max-width: 900px)'));
    expect(media.lists.get('(max-width: 900px)')?.listeners.size).toBe(1);
    unmount();
    expect(media.lists.get('(max-width: 900px)')?.listeners.size).toBe(0);
  });
});
