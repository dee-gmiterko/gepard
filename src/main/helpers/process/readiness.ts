import type { EventEmitter } from 'node:events';
import type { Readable } from 'node:stream';
import { AppError, errorMessage } from '@gepard/common';
import { makeLineSplitter } from './exec';

export const WINDOW_SHOWN_SWITCH = 'report-window-shown';
export const WINDOW_SHOWN_MARKER = 'gepard:window-shown';

export interface SpawnedProcess extends EventEmitter {
  stdout: Readable | null;
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
