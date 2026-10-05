import { describe, expect, it } from 'vitest';
import { appCommand, positionalFromArgv } from '../helpers/process/argv';

describe('positionalFromArgv', () => {
  it('reads the first positional argument of a packaged binary', () => {
    expect(positionalFromArgv(['/opt/gepard', 'https://github.com/o/r'], false)).toBe(
      'https://github.com/o/r',
    );
    expect(positionalFromArgv(['/opt/gepard', 'o/r'], false)).toBe('o/r');
  });

  it('skips the app path when started as `electron .`', () => {
    expect(positionalFromArgv(['electron', '.', 'o/r'], true)).toBe('o/r');
    expect(positionalFromArgv(['electron', '.'], true)).toBeNull();
  });

  it('ignores switches and honours the `--` separator', () => {
    expect(
      positionalFromArgv(
        ['electron', '.', '--remote-debugging-port=9222', '--inspect=5858', 'o/r'],
        true,
      ),
    ).toBe('o/r');
    expect(positionalFromArgv(['/opt/gepard', 'o/r', '--report-window-shown'], false)).toBe('o/r');
    expect(positionalFromArgv(['/opt/gepard', '--no-sandbox', '--', '-weird'], false)).toBe(
      '-weird',
    );
    expect(positionalFromArgv(['/opt/gepard', '--'], false)).toBeNull();
  });

  it('returns null without a positional argument', () => {
    expect(positionalFromArgv(['/opt/gepard'], false)).toBeNull();
    expect(positionalFromArgv(['/opt/gepard', '--no-sandbox'], false)).toBeNull();
  });
});

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
