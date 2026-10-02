import { describe, expect, it } from 'vitest';
import { runLines } from '../helpers/process/exec';
import { ExecError } from '../helpers/process/ExecError';

const node = process.execPath;

async function collect(script: string): Promise<{ lines: string[]; stopped: boolean }> {
  const lines: string[] = [];
  const { stopped } = await runLines(node, ['-e', script], { onLine: (l) => void lines.push(l) });
  return { lines, stopped };
}

describe('runLines', () => {
  it('delivers each stdout line, including a last line with no newline', async () => {
    const { lines, stopped } = await collect("process.stdout.write('one\\ntwo\\nthree')");
    expect(lines).toEqual(['one', 'two', 'three']);
    expect(stopped).toBe(false);
  });

  it('strips a carriage return from a CRLF line', async () => {
    const { lines } = await collect("process.stdout.write('a\\r\\nb\\r\\n')");
    expect(lines).toEqual(['a', 'b']);
  });

  it('keeps a multi-byte character intact when it is split across chunks', async () => {
    const { lines } = await collect("process.stdout.write('é'.repeat(200000) + '\\n')");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('é'.repeat(200000));
  });

  it('stops the process and resolves as soon as onLine asks it to', async () => {
    const lines: string[] = [];
    const result = await runLines(
      node,
      ['-e', "for (let i = 0; i < 2e6; i++) console.log('line ' + i)"],
      {
        onLine: (l) => {
          lines.push(l);
          return lines.length === 10 ? 'stop' : undefined;
        },
      },
    );
    expect(result.stopped).toBe(true);
    expect(lines).toHaveLength(10);
    expect(lines[9]).toBe('line 9');
  });

  it('rejects with the exit code when the process fails', async () => {
    await expect(collect('process.exit(3)')).rejects.toMatchObject({
      name: 'AppError',
      code: 'EXEC_FAILED',
      exitCode: 3,
    });
  });

  it('rejects with EXEC_NOT_FOUND for a missing binary', async () => {
    await expect(
      runLines('gepard-no-such-binary', [], { onLine: () => undefined }),
    ).rejects.toThrow(ExecError);
  });

  it('rejects, and stops the process, when onLine throws', async () => {
    await expect(
      runLines(node, ['-e', "for (let i = 0; i < 2e6; i++) console.log('x')"], {
        onLine: () => {
          throw new Error('handler failed');
        },
      }),
    ).rejects.toThrow('handler failed');
  });

  it('rejects with an AbortError when the signal is already aborted', async () => {
    await expect(
      runLines(node, ['-e', 'setTimeout(() => {}, 1000)'], {
        signal: AbortSignal.abort(),
        onLine: () => undefined,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
