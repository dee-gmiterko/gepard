import { describe, expect, it } from 'vitest';
import type { Project } from '@gepard/common';
import {
  detachedLaunchCommand,
  findProjectByName,
  isGitHubUrl,
  launchTargetFromArgv,
} from '../helpers/launch';

function project(owner: string, repo: string): Project {
  return {
    id: `${owner}__${repo}`.toLowerCase(),
    url: `https://github.com/${owner}/${repo}`,
    owner,
    repo,
    addedAt: '2024-01-01T00:00:00.000Z',
    cloned: true,
  };
}

describe('launchTargetFromArgv', () => {
  it('reads the first positional argument of a packaged binary', () => {
    expect(launchTargetFromArgv(['/opt/gepard', 'https://github.com/o/r'], false)).toBe(
      'https://github.com/o/r',
    );
    expect(launchTargetFromArgv(['/opt/gepard', 'o/r'], false)).toBe('o/r');
  });

  it('skips the app path when started as `electron .`', () => {
    expect(launchTargetFromArgv(['electron', '.', 'o/r'], true)).toBe('o/r');
    expect(launchTargetFromArgv(['electron', '.'], true)).toBeNull();
  });

  it('ignores switches and honours the `--` separator', () => {
    expect(
      launchTargetFromArgv(
        ['electron', '.', '--remote-debugging-port=9222', '--inspect=5858', 'o/r'],
        true,
      ),
    ).toBe('o/r');
    expect(launchTargetFromArgv(['/opt/gepard', '--no-sandbox', '--', '-weird'], false)).toBe(
      '-weird',
    );
    expect(launchTargetFromArgv(['/opt/gepard', '--'], false)).toBeNull();
  });

  it('returns null without a target', () => {
    expect(launchTargetFromArgv(['/opt/gepard'], false)).toBeNull();
    expect(launchTargetFromArgv(['/opt/gepard', '--no-sandbox'], false)).toBeNull();
  });
});

describe('isGitHubUrl', () => {
  it('distinguishes URLs from project names', () => {
    expect(isGitHubUrl('https://github.com/o/r')).toBe(true);
    expect(isGitHubUrl('HTTP://github.com/o/r')).toBe(true);
    expect(isGitHubUrl('o/r')).toBe(false);
    expect(isGitHubUrl('github.com/o/r')).toBe(false);
  });
});

describe('findProjectByName', () => {
  const projects = [project('Dee', 'gepard'), project('acme', 'tool'), project('other', 'tool')];

  it('matches owner/repo as shown in the launchpad, ignoring case', () => {
    expect(findProjectByName(projects, 'dee/gepard')).toBe(projects[0]);
    expect(findProjectByName(projects, 'Acme/Tool')).toBe(projects[1]);
  });

  it('matches the project id', () => {
    expect(findProjectByName(projects, 'other__tool')).toBe(projects[2]);
  });

  it('matches a bare repo name only when it is unambiguous', () => {
    expect(findProjectByName(projects, 'gepard')).toBe(projects[0]);
    expect(findProjectByName(projects, 'tool')).toBeNull();
  });

  it('returns null for unknown names', () => {
    expect(findProjectByName(projects, 'nobody/nothing')).toBeNull();
    expect(findProjectByName([], 'gepard')).toBeNull();
  });
});

describe('detachedLaunchCommand', () => {
  const target = 'https://github.com/o/r';

  it('runs the packaged executable with the target', () => {
    expect(
      detachedLaunchCommand(target, {
        execPath: '/opt/gepard',
        appPath: '/opt/resources/app.asar',
        defaultApp: false,
        appImage: undefined,
      }),
    ).toEqual({ command: '/opt/gepard', args: [target] });
  });

  it('passes the app path first under `electron .`', () => {
    expect(
      detachedLaunchCommand(target, {
        execPath: '/repo/node_modules/electron/dist/electron',
        appPath: '/repo/src/app',
        defaultApp: true,
        appImage: undefined,
      }),
    ).toEqual({
      command: '/repo/node_modules/electron/dist/electron',
      args: ['/repo/src/app', target],
    });
  });

  it('prefers the AppImage file over the mounted executable', () => {
    expect(
      detachedLaunchCommand(target, {
        execPath: '/tmp/.mount_gepard/gepard',
        appPath: '/tmp/.mount_gepard/resources/app.asar',
        defaultApp: false,
        appImage: '/home/me/gepard.AppImage',
      }),
    ).toEqual({ command: '/home/me/gepard.AppImage', args: [target] });
  });
});
