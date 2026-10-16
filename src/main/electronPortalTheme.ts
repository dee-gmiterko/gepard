import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { nativeTheme } from 'electron';
import type { ThemeContrast } from '@gepard/common';
import type { LoggerService } from './log';

const PORTAL_DEST = 'org.freedesktop.portal.Desktop';
const PORTAL_PATH = '/org/freedesktop/portal/desktop';
const NAMESPACE = 'org.freedesktop.appearance';
const COLOR_SCHEME_KEY = 'color-scheme';
const CONTRAST_KEY = 'contrast';
const REDUCED_MOTION_KEY = 'reduced-motion';

const COLOR_SCHEME_PREFER_DARK = 1;
const COLOR_SCHEME_PREFER_LIGHT = 2;
const CONTRAST_HIGH = 1;
const REDUCED_MOTION_REDUCE = 1;

const UINT32_PATTERN = /uint32\s+(\d+)/;

function parseUint32(output: string): number | null {
  const match = UINT32_PATTERN.exec(output);
  return match ? Number(match[1]) : null;
}

export class PortalTheme {
  private currentContrast: ThemeContrast = 'normal';
  private currentReducedMotion = false;

  constructor(private readonly logger: LoggerService) {}

  contrast(): ThemeContrast {
    return this.currentContrast;
  }

  reducedMotion(): boolean {
    return this.currentReducedMotion;
  }

  startSync(onPreferenceChange: () => void): () => void {
    if (process.platform !== 'linux') return () => undefined;

    let monitor: ChildProcess | null = null;
    let stopped = false;

    this.readSetting(COLOR_SCHEME_KEY, (output) => {
      if (!stopped) this.applyColorScheme(output);
    });
    this.readSetting(CONTRAST_KEY, (output) => {
      if (!stopped) this.applyContrast(output, onPreferenceChange);
    });
    this.readSetting(REDUCED_MOTION_KEY, (output) => {
      if (!stopped) this.applyReducedMotion(output, onPreferenceChange);
    });

    try {
      monitor = spawn(
        'gdbus',
        ['monitor', '--session', '--dest', PORTAL_DEST, '--object-path', PORTAL_PATH],
        { stdio: ['ignore', 'pipe', 'ignore'] },
      );
      monitor.on('error', (err) =>
        this.logger.warn('theme', `portal monitor error: ${err.message}`),
      );
      let buffer = '';
      monitor.stdout?.setEncoding('utf8');
      monitor.stdout?.on('data', (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.includes('SettingChanged') || !line.includes(NAMESPACE)) continue;
          if (line.includes(`'${COLOR_SCHEME_KEY}'`)) this.applyColorScheme(line);
          else if (line.includes(`'${CONTRAST_KEY}'`)) this.applyContrast(line, onPreferenceChange);
          else if (line.includes(`'${REDUCED_MOTION_KEY}'`))
            this.applyReducedMotion(line, onPreferenceChange);
        }
      });
    } catch (err) {
      this.logger.warn('theme', `portal monitor spawn failed: ${String(err)}`);
      monitor = null;
    }

    return () => {
      stopped = true;
      monitor?.kill();
      monitor = null;
    };
  }

  private applyColorScheme(output: string): void {
    const value = parseUint32(output);
    if (value === null) return;
    nativeTheme.themeSource =
      value === COLOR_SCHEME_PREFER_DARK
        ? 'dark'
        : value === COLOR_SCHEME_PREFER_LIGHT
          ? 'light'
          : 'system';
  }

  private applyContrast(output: string, onChange: () => void): void {
    const value = parseUint32(output);
    if (value === null) return;
    const next: ThemeContrast = value === CONTRAST_HIGH ? 'high' : 'normal';
    if (next === this.currentContrast) return;
    this.currentContrast = next;
    onChange();
  }

  private applyReducedMotion(output: string, onChange: () => void): void {
    const value = parseUint32(output);
    if (value === null) return;
    const next = value === REDUCED_MOTION_REDUCE;
    if (next === this.currentReducedMotion) return;
    this.currentReducedMotion = next;
    onChange();
  }

  private readSetting(key: string, onOutput: (output: string) => void): void {
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
        if (err) this.logger.warn('theme', `portal initial read of ${key} failed: ${err.message}`);
        else onOutput(stdout);
      },
    );
  }
}
