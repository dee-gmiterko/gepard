import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { AppError } from '@gepard/common';
import { WINDOW_SHOWN_MARKER, appCommand, waitForLine } from '../helpers/process/instance';

describe('appCommand', () => {
  const args = ['https://github.com/o/r', '--report-window-shown'];

  it('runs the packaged executable with the arguments', () => {
    expect(
      appCommand(args, {
        execPath: '/opt/gepard',
        appPath: '/opt/resources/app.asar',
        defaultApp: false,
        appImage: undefined,
      }),
    ).toEqual({ command: '/opt/gepard', args });
  });

  it('passes the app path first under `electron .`', () => {
    expect(
      appCommand(args, {
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
      appCommand(args, {
        execPath: '/tmp/.mount_gepard/gepard',
        appPath: '/tmp/.mount_gepard/resources/app.asar',
        defaultApp: false,
        appImage: '/home/me/gepard.AppImage',
      }),
    ).toEqual({ command: '/home/me/gepard.AppImage', args });
  });
});

const node = process.execPath;

function child(script: string): ReturnType<typeof spawn> {
  return spawn(node, ['-e', script], { stdio: ['ignore', 'pipe', 'ignore'] });
}

describe('waitForLine', () => {
  it('resolves once the marker line arrives, ignoring other output', async () => {
    const output = `log line\\n${WINDOW_SHOWN_MARKER}\\nmore\\n`;
    const proc = child(`process.stdout.write('${output}'); setTimeout(() => {}, 200)`);
    await expect(waitForLine(proc, WINDOW_SHOWN_MARKER, 5000)).resolves.toBe(true);
    proc.kill();
  });

  it('does not match a line that merely contains the marker', async () => {
    const proc = child(`process.stdout.write('x${WINDOW_SHOWN_MARKER}\\n')`);
    await expect(waitForLine(proc, WINDOW_SHOWN_MARKER, 5000)).rejects.toBeInstanceOf(AppError);
  });

  it('rejects when the process exits before reporting', async () => {
    const proc = child('process.exit(3)');
    await expect(waitForLine(proc, WINDOW_SHOWN_MARKER, 5000)).rejects.toMatchObject({
      code: 'LAUNCH_FAILED',
      message: 'instance exited with code 3',
    });
  });

  it('rejects when the process cannot be spawned', async () => {
    const proc = spawn('/nonexistent/gepard', [], { stdio: ['ignore', 'pipe', 'ignore'] });
    await expect(waitForLine(proc, WINDOW_SHOWN_MARKER, 5000)).rejects.toMatchObject({
      code: 'LAUNCH_FAILED',
    });
  });

  it('resolves false after the timeout while the process keeps running', async () => {
    const proc = child('setTimeout(() => {}, 5000)');
    await expect(waitForLine(proc, WINDOW_SHOWN_MARKER, 100)).resolves.toBe(false);
    proc.kill();
  });

  it('rejects without a stdout pipe', async () => {
    const proc = spawn(node, ['-e', ''], { stdio: 'ignore' });
    await expect(waitForLine(proc, WINDOW_SHOWN_MARKER, 5000)).rejects.toThrow('stdout');
  });
});
