import { ExecError } from '@gepard/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { run, runBuffer, runJson } from '../helpers/process/exec';

const node = process.execPath;

describe('run', () => {
  it('collects stdout and rejects with an ExecError on a non-zero exit', async () => {
    const ok = await run(node, ['-e', "process.stdout.write('hi')"]);
    expect(ok).toMatchObject({ stdout: 'hi', exitCode: 0 });
    await expect(run(node, ['-e', 'process.exit(3)'])).rejects.toBeInstanceOf(ExecError);
  });
});

describe('runBuffer', () => {
  it('returns stdout as raw bytes', async () => {
    const out = await runBuffer(node, ['-e', 'process.stdout.write(Buffer.from([0, 255, 1]))']);
    expect([...out.stdout]).toEqual([0, 255, 1]);
  });
});

describe('runJson', () => {
  const schema = z.object({ a: z.number() });

  it('parses and validates stdout', async () => {
    expect(await runJson(schema, node, ['-e', 'console.log(\'{"a":1}\')'])).toEqual({ a: 1 });
  });

  it('fails with BAD_JSON for invalid JSON and SCHEMA_MISMATCH for the wrong shape', async () => {
    await expect(runJson(schema, node, ['-e', "console.log('nope')"])).rejects.toMatchObject({
      code: 'BAD_JSON',
    });
    await expect(runJson(schema, node, ['-e', 'console.log(\'{"a":"x"}\')'])).rejects.toMatchObject(
      {
        code: 'SCHEMA_MISMATCH',
      },
    );
  });
});
