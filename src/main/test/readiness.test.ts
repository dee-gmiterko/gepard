import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { AppError } from '@gepard/common';
import { WINDOW_SHOWN_MARKER, waitForLine } from '../helpers/process/readiness';

const node = process.execPath;

function child(script: string): ReturnType<typeof spawn> {
  return spawn(node, ['-e', script], { stdio: ['ignore', 'pipe', 'ignore'] });
}

describe('waitForLine', () => {
  it('resolves once the marker line arrives, ignoring other output', async () => {
    const output = `log line\\n${WINDOW_SHOWN_MARKER}\\nmore\\n`;
    const proc = child(`process.stdout.write('${output}'); setTimeout(() => {}, 200)`);
    await expect(waitForLine(proc, WINDOW_SHOWN_MARKER, 5000)).resolves.toBe(true);
    proc.kill();
  });

  it('does not match a line that merely contains the marker', async () => {
    const proc = child(`process.stdout.write('x${WINDOW_SHOWN_MARKER}\\n')`);
    await expect(waitForLine(proc, WINDOW_SHOWN_MARKER, 5000)).rejects.toBeInstanceOf(AppError);
  });

  it('rejects when the process exits before reporting', async () => {
    const proc = child('process.exit(3)');
    await expect(waitForLine(proc, WINDOW_SHOWN_MARKER, 5000)).rejects.toMatchObject({
      code: 'LAUNCH_FAILED',
      message: 'instance exited with code 3',
    });
  });

  it('rejects when the process cannot be spawned', async () => {
    const proc = spawn('/nonexistent/gepard', [], { stdio: ['ignore', 'pipe', 'ignore'] });
    await expect(waitForLine(proc, WINDOW_SHOWN_MARKER, 5000)).rejects.toMatchObject({
      code: 'LAUNCH_FAILED',
    });
  });

  it('resolves false after the timeout while the process keeps running', async () => {
    const proc = child('setTimeout(() => {}, 5000)');
    await expect(waitForLine(proc, WINDOW_SHOWN_MARKER, 100)).resolves.toBe(false);
    proc.kill();
  });

  it('rejects without a stdout pipe', async () => {
    const proc = spawn(node, ['-e', ''], { stdio: 'ignore' });
    await expect(waitForLine(proc, WINDOW_SHOWN_MARKER, 5000)).rejects.toThrow('stdout');
  });
});
