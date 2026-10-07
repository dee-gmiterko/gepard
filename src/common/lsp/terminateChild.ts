import type { ChildProcess } from 'node:child_process';

export async function terminateChild(child: ChildProcess, ms: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  child.kill();
  const timer = setTimeout(() => child.kill('SIGKILL'), ms);
  await exited;
  clearTimeout(timer);
}
