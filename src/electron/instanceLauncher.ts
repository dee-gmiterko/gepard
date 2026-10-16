import { spawn } from 'node:child_process';
import type { InstanceLauncher } from '@gepard/main/instanceLauncher';
import type { LoggerService } from '@gepard/main/log';
import { instanceCommand, waitForInstance } from './instance';

export class ElectronInstanceLauncher implements InstanceLauncher {
  constructor(
    private readonly logger: LoggerService,
    private readonly appPath: string,
  ) {}

  async launch(target: string | null): Promise<void> {
    const { command, args } = instanceCommand(target, {
      execPath: process.execPath,
      appPath: this.appPath,
      defaultApp: Boolean(process.defaultApp),
      appImage: process.env['APPIMAGE'],
    });
    this.logger.info('launch', `detached instance: ${command} ${args.join(' ')}`);
    const child = spawn(command, args, { detached: true, stdio: ['ignore', 'pipe', 'ignore'] });
    child.unref();
    if (!(await waitForInstance(child)))
      this.logger.warn('launch', `no window reported: ${command}`);
  }
}
