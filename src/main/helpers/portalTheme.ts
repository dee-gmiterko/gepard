import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { nativeTheme } from 'electron';
import { log } from '../log';

const PORTAL_DEST = 'org.freedesktop.portal.Desktop';
const PORTAL_PATH = '/org/freedesktop/portal/desktop';
const NAMESPACE = 'org.freedesktop.appearance';
const KEY = 'color-scheme';

// 1 = prefer dark, 2 = prefer light, 0 = no preference.
const COLOR_SCHEME_PATTERN = /uint32\s+(\d+)/;

function apply(output: string): void {
  const match = COLOR_SCHEME_PATTERN.exec(output);
  if (!match) return;
  const value = Number(match[1]);
  nativeTheme.themeSource = value === 1 ? 'dark' : value === 2 ? 'light' : 'system';
}

// Electron on Linux derives dark mode from the GTK theme and ignores the
// freedesktop portal, so the portal's color scheme is mirrored into themeSource.
export function startPortalThemeSync(): () => void {
  if (process.platform !== 'linux') return () => undefined;

  let monitor: ChildProcess | null = null;
  let stopped = false;

  execFile(
    'gdbus',
    [
      'call',
      '--session',
      '--dest',
      PORTAL_DEST,
      '--object-path',
      PORTAL_PATH,
      '--method',
      'org.freedesktop.portal.Settings.Read',
      NAMESPACE,
      KEY,
    ],
    { timeout: 5000 },
    (err, stdout) => {
      if (err) log.warn('theme', `portal initial read failed: ${err.message}`);
      else if (!stopped) apply(stdout);
    },
  );

  try {
    monitor = spawn(
      'gdbus',
      ['monitor', '--session', '--dest', PORTAL_DEST, '--object-path', PORTAL_PATH],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    );
    monitor.on('error', (err) => log.warn('theme', `portal monitor error: ${err.message}`));
    let buffer = '';
    monitor.stdout?.setEncoding('utf8');
    monitor.stdout?.on('data', (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.includes('SettingChanged') && line.includes(NAMESPACE) && line.includes(KEY)) {
          apply(line);
        }
      }
    });
  } catch (err) {
    log.warn('theme', `portal monitor spawn failed: ${String(err)}`);
    monitor = null;
  }

  return () => {
    stopped = true;
    monitor?.kill();
    monitor = null;
  };
}
