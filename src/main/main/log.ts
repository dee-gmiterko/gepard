export interface LoggerService {
  info(scope: string, message: string): void;
  warn(scope: string, message: string): void;
  error(scope: string, message: string): void;
  filePath(): string;
}
