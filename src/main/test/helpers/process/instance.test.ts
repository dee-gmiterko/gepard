import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { AppError } from '@gepard/common';
import { instanceCommand, waitForInstance, waitForLine } from '../../../helpers/process/instance';

const MARKER = 'gepard:window-shown';

describe('instanceCommand', () => {
  const target = 'https://github.com/o/r';
  const args = [target, '--report-window-shown'];

  it('runs the packaged executable with the arguments', () => {
    expect(
      instanceCommand(target, {
        execPath: '/opt/gepard',
        appPath: '/opt/resources/app.asar',
        defaultApp: false,
        appImage: undefined,
      }),
    ).toEqual({ command: '/opt/gepard', args });
  });

  it('passes the app path first under `electron .`', () => {
    expect(
      instanceCommand(target, {
        execPath: '/repo/node_modules/electron/dist/electron',
        appPath: '/repo/src/app',
        defaultApp: true,
        appImage: undefined,
      }),
    ).toEqual({
      command: '/repo/node_modules/electron/dist/electron',
      args: ['/repo/src/app', ...args],
    });
  });

  it('prefers the AppImage file over the mounted executable', () => {
    expect(
      instanceCommand(target, {
        execPath: '/tmp/.mount_gepard/gepard',
        appPath: '/tmp/.mount_gepard/resources/app.asar',
        defaultApp: false,
        appImage: '/home/me/gepard.AppImage',
      }),
    ).toEqual({ command: '/home/me/gepard.AppImage', args });
  });

  it('passes only the report switch without a target', () => {
    expect(
      instanceCommand(null, {
        execPath: '/opt/gepard',
        appPath: '/opt/resources/app.asar',
        defaultApp: false,
        appImage: undefined,
      }),
    ).toEqual({ command: '/opt/gepard', args: ['--report-window-shown'] });
    expect(
      instanceCommand(null, {
        execPath: '/repo/node_modules/electron/dist/electron',
        appPath: '/repo/src/app',
        defaultApp: true,
        appImage: undefined,
      }),
    ).toEqual({
      command: '/repo/node_modules/electron/dist/electron',
      args: ['/repo/src/app', '--report-window-shown'],
    });
  });
});

const node = process.execPath;

function child(script: string): ReturnType<typeof spawn> {
  return spawn(node, ['-e', script], { stdio: ['ignore', 'pipe', 'ignore'] });
}

describe('waitForInstance', () => {
  it('resolves once the window-shown marker arrives, ignoring other output', async () => {
    const output = `log line\\n${MARKER}\\nmore\\n`;
    const proc = child(`process.stdout.write('${output}'); setTimeout(() => {}, 200)`);
    await expect(waitForInstance(proc)).resolves.toBe(true);
    proc.kill();
  });

  it('does not match a line that merely contains the marker', async () => {
    const proc = child(`process.stdout.write('x${MARKER}\\n')`);
    await expect(waitForInstance(proc)).rejects.toBeInstanceOf(AppError);
  });

  it('rejects when the instance exits before showing a window', async () => {
    const proc = child('process.exit(3)');
    await expect(waitForInstance(proc)).rejects.toMatchObject({
      code: 'LAUNCH_FAILED',
      message: 'instance exited with code 3',
    });
  });

  it('rejects when the instance cannot be spawned', async () => {
    const proc = spawn('/nonexistent/gepard', [], { stdio: ['ignore', 'pipe', 'ignore'] });
    await expect(waitForInstance(proc)).rejects.toMatchObject({ code: 'LAUNCH_FAILED' });
  });
});

describe('waitForLine', () => {
  it('resolves false after the timeout while the process keeps running', async () => {
    const proc = child('setTimeout(() => {}, 5000)');
    await expect(waitForLine(proc, MARKER, 100)).resolves.toBe(false);
    proc.kill();
  });

  it('rejects without a stdout pipe', async () => {
    const proc = spawn(node, ['-e', ''], { stdio: 'ignore' });
    await expect(waitForLine(proc, MARKER, 5000)).rejects.toThrow('stdout');
  });
});
