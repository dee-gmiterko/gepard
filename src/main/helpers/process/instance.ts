import type { EventEmitter } from 'node:events';
import type { Readable } from 'node:stream';
import type { BrowserWindow } from 'electron';
import { AppError, errorMessage } from '@gepard/common';
import { makeLineSplitter } from './exec';

export const REPORT_WINDOW_SHOWN_SWITCH = 'report-window-shown';
const WINDOW_SHOWN_MARKER = 'gepard:window-shown';
const WINDOW_SHOWN_TIMEOUT_MS = 8_000;

export interface InstanceEnv {
  execPath: string;
  appPath: string;
  defaultApp: boolean;
  appImage: string | undefined;
}

export function instanceCommand(
  target: string,
  env: InstanceEnv,
): { command: string; args: string[] } {
  const args = [target, `--${REPORT_WINDOW_SHOWN_SWITCH}`];
  if (env.appImage) return { command: env.appImage, args };
  if (env.defaultApp) return { command: env.execPath, args: [env.appPath, ...args] };
  return { command: env.execPath, args };
}

export function reportWindowShown(window: BrowserWindow): void {
  process.stdout.on('error', () => undefined);
  window.once('show', () => process.stdout.write(`${WINDOW_SHOWN_MARKER}\n`));
}

export interface SpawnedProcess extends EventEmitter {
  stdout: Readable | null;
}

export function waitForInstance(child: SpawnedProcess): Promise<boolean> {
  return waitForLine(child, WINDOW_SHOWN_MARKER, WINDOW_SHOWN_TIMEOUT_MS);
}

export function waitForLine(
  child: SpawnedProcess,
  line: string,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const stdout = child.stdout;
    if (!stdout) {
      reject(new Error('child process has no stdout pipe'));
      return;
    }
    const finish = (settle: () => void): void => {
      clearTimeout(timer);
      stdout.off('data', onData);
      child.off('exit', onExit);
      child.off('error', onError);
      stdout.resume();
      settle();
    };
    const onData = makeLineSplitter((received) => {
      if (received === line) finish(() => resolve(true));
    });
    const onExit = (code: number | null): void =>
      finish(() => reject(new AppError('LAUNCH_FAILED', `instance exited with code ${code}`)));
    const onError = (err: unknown): void =>
      finish(() => reject(new AppError('LAUNCH_FAILED', errorMessage(err))));
    const timer = setTimeout(() => finish(() => resolve(false)), timeoutMs);
    stdout.on('data', onData);
    child.once('exit', onExit);
    child.once('error', onError);
  });
}
