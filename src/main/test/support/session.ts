import { vi } from 'vitest';
import type { LanguageSession } from '@gepard/common';

export function fakeLanguageSession(overrides: Partial<LanguageSession> = {}): LanguageSession {
  return {
    lineSymbols: vi.fn(() => Promise.resolve([])),
    definition: vi.fn(() => Promise.resolve([])),
    references: vi.fn(() => Promise.resolve([])),
    workspaceSymbols: vi.fn(() => Promise.resolve([])),
    documentSymbols: vi.fn(() => Promise.resolve([])),
    filesChanged: vi.fn(),
    dispose: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}
