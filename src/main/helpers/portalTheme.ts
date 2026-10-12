import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { nativeTheme } from 'electron';
import { log } from '../log';

const PORTAL_DEST = 'org.freedesktop.portal.Desktop';
const PORTAL_PATH = '/org/freedesktop/portal/desktop';
const NAMESPACE = 'org.freedesktop.appearance';
const COLOR_SCHEME_KEY = 'color-scheme';
const CONTRAST_KEY = 'contrast';

const UINT32_PATTERN = /uint32\s+(\d+)/;

let highContrast = false;

export function portalPrefersHighContrast(): boolean {
  return highContrast;
}

function parseUint32(output: string): number | null {
  const match = UINT32_PATTERN.exec(output);
  return match ? Number(match[1]) : null;
}

// 1 = prefer dark, 2 = prefer light, 0 = no preference.
function applyColorScheme(output: string): void {
  const value = parseUint32(output);
  if (value === null) return;
  nativeTheme.themeSource = value === 1 ? 'dark' : value === 2 ? 'light' : 'system';
}

// 1 = high contrast, 0 = no preference.
function applyContrast(output: string, onChange: () => void): void {
  const value = parseUint32(output);
  if (value === null) return;
  const next = value === 1;
  if (next === highContrast) return;
  highContrast = next;
  onChange();
}

function readSetting(key: string, onOutput: (output: string) => void): void {
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
      key,
    ],
    { timeout: 5000 },
    (err, stdout) => {
      if (err) log.warn('theme', `portal initial read of ${key} failed: ${err.message}`);
      else onOutput(stdout);
    },
  );
}

// Electron on Linux derives dark mode from the GTK theme and ignores the
// freedesktop portal, so the portal's color scheme is mirrored into themeSource.
export function startPortalThemeSync(onContrastChange: () => void): () => void {
  if (process.platform !== 'linux') return () => undefined;

  let monitor: ChildProcess | null = null;
  let stopped = false;

  readSetting(COLOR_SCHEME_KEY, (output) => {
    if (!stopped) applyColorScheme(output);
  });
  readSetting(CONTRAST_KEY, (output) => {
    if (!stopped) applyContrast(output, onContrastChange);
  });

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
        if (!line.includes('SettingChanged') || !line.includes(NAMESPACE)) continue;
        if (line.includes(`'${COLOR_SCHEME_KEY}'`)) applyColorScheme(line);
        else if (line.includes(`'${CONTRAST_KEY}'`)) applyContrast(line, onContrastChange);
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
