import { NewWindowUnavailableError } from '@gepard/common';
import type { InstanceLauncher } from '@gepard/main/instanceLauncher';

export class NoInstanceLauncher implements InstanceLauncher {
  launch(): Promise<void> {
    return Promise.reject(new NewWindowUnavailableError());
  }
}
