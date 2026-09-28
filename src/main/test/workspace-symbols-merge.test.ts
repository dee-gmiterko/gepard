import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LanguageSession, WorkspaceSymbol } from '../lsp/session';

const mocks = vi.hoisted(() => ({ sessions: [] as unknown[] }));

vi.mock('../lsp', () => ({
  indexer: {
    currentSha: () => null,
    sessions: () => mocks.sessions,
    session: () => null,
    lineIndex: () => null,
  },
}));

const { searchHandlers } = await import('../ipc/handlers/search');

function symbol(name: string): WorkspaceSymbol {
  return {
    name,
    kind: 'function',
    location: {
      path: `${name}.ts`,
      range: { start: { line: 1, col: 1 }, end: { line: 1, col: 2 } },
    },
  };
}

function sessionReturning(result: Promise<WorkspaceSymbol[]>): LanguageSession {
  return { workspaceSymbols: vi.fn(() => result) } as unknown as LanguageSession;
}

async function query(limit?: number): Promise<WorkspaceSymbol[]> {
  const handler = searchHandlers['symbols.workspace'] as unknown as (
    input: unknown,
    ctx: unknown,
  ) => Promise<WorkspaceSymbol[]>;
  return handler({ projectId: 'p', sha: 'sha', query: 'q', limit }, {});
}

describe('symbols.workspace across sessions', () => {
  beforeEach(() => {
    mocks.sessions = [];
  });

  it('merges the results of every session', async () => {
    mocks.sessions = [
      sessionReturning(Promise.resolve([symbol('a')])),
      sessionReturning(Promise.resolve([symbol('b'), symbol('c')])),
    ];

    expect((await query()).map((s) => s.name)).toEqual(['a', 'b', 'c']);
  });

  it('caps the merged results at the requested limit', async () => {
    mocks.sessions = [
      sessionReturning(Promise.resolve([symbol('a'), symbol('b')])),
      sessionReturning(Promise.resolve([symbol('c'), symbol('d')])),
    ];

    expect((await query(3)).map((s) => s.name)).toEqual(['a', 'b', 'c']);
  });

  it('still answers from the working sessions when one session fails', async () => {
    mocks.sessions = [
      sessionReturning(Promise.reject(new Error('server crashed'))),
      sessionReturning(Promise.resolve([symbol('b')])),
    ];

    expect((await query()).map((s) => s.name)).toEqual(['b']);
  });

  it('rethrows when every session fails', async () => {
    mocks.sessions = [
      sessionReturning(Promise.reject(new Error('first crashed'))),
      sessionReturning(Promise.reject(new Error('second crashed'))),
    ];

    await expect(query()).rejects.toThrow('first crashed');
  });

  it('returns no results when the project has no session', async () => {
    expect(await query()).toEqual([]);
  });
});
