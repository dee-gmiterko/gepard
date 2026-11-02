import { ExecExitError } from '@gepard/common';
import type { MergeMethod } from '@gepard/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GhClient } from '../../clients/gh';
import type { run as execRun, runJson as execRunJson } from '../../helpers/process/exec';
import { GhService } from '../../services/gh';
import { ConnectivityService } from '../../services/connectivity';
import { FileLockService } from '../../services/fileLock';
import { IpcEventService } from '../../ipc/events';
import { ProjectStore } from '../../store/projects';
import { makeUserData, silentLogger, type UserData } from '../support/tmp';

describe('GhService.mergePr', () => {
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

  function serviceWith(run: typeof execRun): GhService {
    const runJson: typeof execRunJson = () => Promise.reject(new Error('unexpected json call'));
    return new GhService(new GhClient(connectivity, run, runJson), projects);
  }

  it.each([
    ['MERGE', '--merge'],
    ['SQUASH', '--squash'],
    ['REBASE', '--rebase'],
  ] as [MergeMethod, string][])('runs gh pr merge with %s', async (method, flag) => {
    const spawned: { cmd: string; args: string[] }[] = [];
    const service = serviceWith((cmd, args) => {
      spawned.push({ cmd, args });
      return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 });
    });

    await service.mergePr('acme', 'widgets', 42, method);

    expect(spawned).toEqual([
      { cmd: 'gh', args: ['pr', 'merge', '42', '-R', 'acme/widgets', flag] },
    ]);
  });

  it('propagates a gh failure', async () => {
    const failure = new ExecExitError(
      'gh',
      ['pr', 'merge'],
      1,
      null,
      'Pull request is not mergeable',
    );
    const service = serviceWith(() => Promise.reject(failure));

    await expect(service.mergePr('acme', 'widgets', 42, 'MERGE')).rejects.toThrow(/not mergeable/);
  });
});
