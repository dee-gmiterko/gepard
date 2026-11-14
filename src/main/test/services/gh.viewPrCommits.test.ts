import type { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GhClient } from '../../clients/gh';
import type { runJson as execRunJson } from '../../helpers/process/exec';
import { GhService } from '../../services/gh';
import { ConnectivityService } from '../../services/connectivity';
import { FileLockService } from '../../services/fileLock';
import { IpcEventService } from '../../ipc/events';
import { ProjectStore } from '../../store/projects';
import { makeUserData, silentLogger, type UserData } from '../support/tmp';

const sha = (i: number): string => i.toString(16).padStart(40, '0');

function node(i: number): object {
  return {
    commit: {
      oid: sha(i),
      messageHeadline: `commit ${i}`,
      messageBody: '',
      authoredDate: '2024-01-01T00:00:00Z',
      committedDate: '2024-01-01T00:00:00Z',
      authors: { nodes: [{ name: 'A', email: 'a@x.io', user: i % 2 ? { login: 'a' } : null }] },
    },
  };
}

function page(from: number, to: number, next: string | null): object {
  const nodes: object[] = [];
  for (let i = from; i < to; i++) nodes.push(node(i));
  return {
    data: {
      repository: {
        pullRequest: {
          commits: { pageInfo: { hasNextPage: next !== null, endCursor: next }, nodes },
        },
      },
    },
  };
}

describe('GhService.viewPrCommits', () => {
  let userData: UserData;
  let projects: ProjectStore;
  let connectivity: ConnectivityService;

  beforeAll(async () => {
    userData = await makeUserData();
    projects = new ProjectStore(userData.paths, silentLogger, new FileLockService());
    connectivity = new ConnectivityService(silentLogger, new IpcEventService());
  });

  afterAll(async () => {
    await userData.cleanup();
  });

  it('follows pagination past 100 commits', async () => {
    const cursors: unknown[] = [];
    const pages = [page(0, 100, 'c1'), page(100, 150, null)];
    const runJson = ((
      schema: z.ZodType,
      _cmd: string,
      _args: string[],
      opts: { stdin?: string },
    ) => {
      cursors.push((JSON.parse(opts.stdin ?? '{}') as { variables: unknown }).variables);
      return Promise.resolve(schema.parse(pages.shift()));
    }) as unknown as typeof execRunJson;
    const service = new GhService(
      new GhClient(connectivity, () => Promise.reject(new Error('unexpected')), runJson),
      projects,
    );

    const commits = await service.viewPrCommits('acme', 'widgets', 7);

    expect(commits).toHaveLength(150);
    expect(commits[0]).toMatchObject({
      oid: sha(0),
      authors: [{ login: null, name: 'A', email: 'a@x.io' }],
    });
    expect(commits[1]?.authors[0]?.login).toBe('a');
    expect(cursors).toEqual([
      { owner: 'acme', name: 'widgets', number: 7, endCursor: null },
      { owner: 'acme', name: 'widgets', number: 7, endCursor: 'c1' },
    ]);
  });
});
