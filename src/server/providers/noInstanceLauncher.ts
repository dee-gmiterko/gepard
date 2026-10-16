import { AppError } from '@gepard/common';
import type { InstanceLauncher } from '@gepard/main/ports/instanceLauncher';

export class NoInstanceLauncher implements InstanceLauncher {
  launch(): Promise<void> {
    return Promise.reject(
      new AppError('UNAVAILABLE', 'Opening a new window is only available in the desktop app.'),
    );
  }
}
