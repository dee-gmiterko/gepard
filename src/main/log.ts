import { join } from 'node:path';
import { app } from 'electron';
import electronLog from 'electron-log/main';
import { logsDir } from './paths';

electronLog.transports.file.resolvePathFn = () => join(logsDir(), 'main.log');
electronLog.transports.file.maxSize = 5 * 1024 * 1024;
electronLog.transports.console.level = app.isPackaged ? false : 'info';

export const log = {
  info(scope: string, message: string): void {
    electronLog.scope(scope).info(message);
  },
  warn(scope: string, message: string): void {
    electronLog.scope(scope).warn(message);
  },
  error(scope: string, message: string): void {
    electronLog.scope(scope).error(message);
  },
};

export function logFilePath(): string {
  return electronLog.transports.file.getFile().path;
}
