import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { serverChildren, terminateChild, trackChild } from '@gepard/common';

const IGNORES_SIGTERM =
  "process.on('SIGTERM', () => {}); console.log('ready'); setInterval(() => {}, 1000);";

function spawnStubServer(script: string): Promise<ReturnType<typeof spawn>> {
  const child = spawn(process.execPath, ['-e', script], { stdio: ['pipe', 'pipe', 'inherit'] });
  return new Promise((resolve) => child.stdout?.once('data', () => resolve(child)));
}

describe('terminateChild', () => {
  it('ends a child that ignores SIGTERM with SIGKILL after the timeout', async () => {
    const child = await spawnStubServer(IGNORES_SIGTERM);
    const started = Date.now();
    await terminateChild(child, 300);
    expect(child.signalCode).toBe('SIGKILL');
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
  });

  it('returns right after SIGTERM for a child that exits on it', async () => {
    const child = await spawnStubServer("console.log('ready'); setInterval(() => {}, 1000);");
    const started = Date.now();
    await terminateChild(child, 5_000);
    expect(child.signalCode).toBe('SIGTERM');
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('returns at once for a child that already exited', async () => {
    const child = await spawnStubServer("console.log('ready'); process.exit(0);");
    await new Promise((resolve) => child.once('exit', resolve));
    await terminateChild(child, 5_000);
    expect(child.exitCode).toBe(0);
  });
});

describe('trackChild', () => {
  it('registers a running child and forgets it after it exits', async () => {
    const child = await spawnStubServer(IGNORES_SIGTERM);
    trackChild(child);
    expect(serverChildren().has(child)).toBe(true);
    await terminateChild(child, 200);
    expect(serverChildren().has(child)).toBe(false);
  });
});
