import { join } from 'node:path';
import electronLog from 'electron-log/node';
import type { LoggerService } from '../log';
import type { Paths } from '../paths';

const MAX_LOG_FILE_BYTES = 5 * 1024 * 1024;

export class FileLoggerService implements LoggerService {
  constructor(paths: Paths, logToConsole: boolean) {
    electronLog.transports.file.resolvePathFn = () => join(paths.logsDir(), 'main.log');
    electronLog.transports.file.maxSize = MAX_LOG_FILE_BYTES;
    electronLog.transports.console.level = logToConsole ? 'info' : false;
  }

  info(scope: string, message: string): void {
    electronLog.scope(scope).info(message);
  }

  warn(scope: string, message: string): void {
    electronLog.scope(scope).warn(message);
  }

  error(scope: string, message: string): void {
    electronLog.scope(scope).error(message);
  }

  filePath(): string {
    return electronLog.transports.file.getFile().path;
  }
}
