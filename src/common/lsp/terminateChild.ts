import type { ChildProcess } from 'node:child_process';

const REGISTRY_KEY = Symbol.for('gepard.lsp.serverChildren');

// Extensions are bundled separately from the main process, so the registry
// lives on globalThis to be shared between the copies of this module.
export function serverChildren(): Set<ChildProcess> {
  const found: unknown = Reflect.get(globalThis, REGISTRY_KEY);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  if (found instanceof Set) return found;
  const created = new Set<ChildProcess>();
  Reflect.set(globalThis, REGISTRY_KEY, created);
  return created;
}

export function trackChild(child: ChildProcess): void {
  serverChildren().add(child);
  child.once('exit', () => serverChildren().delete(child));
}

export async function terminateChild(child: ChildProcess, ms: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => child.kill('SIGKILL'), ms);
    timer.unref();
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill();
  });
}
