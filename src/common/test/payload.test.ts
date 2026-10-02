import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { packPayload, unpackPayload } from '@gepard/common';

describe('payload', () => {
  let dir: string;

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('round-trips file names, contents and modes', async () => {
    dir = await mkdtemp(join(tmpdir(), 'payload-'));
    const entries = [
      { name: 'tsc', mode: 0o755, data: Buffer.from('binary\0bytes') },
      { name: 'lib.d.ts', mode: 0o644, data: Buffer.from('declare const x: number;') },
    ];

    await unpackPayload(packPayload(entries), join(dir, 'out'));

    expect(await readFile(join(dir, 'out', 'tsc'))).toEqual(entries[0].data);
    expect(await readFile(join(dir, 'out', 'lib.d.ts'), 'utf8')).toBe('declare const x: number;');
    expect((await stat(join(dir, 'out', 'tsc'))).mode & 0o777).toBe(0o755);
  });

  it('rejects an entry that escapes its directory', async () => {
    dir = await mkdtemp(join(tmpdir(), 'payload-'));
    const payload = packPayload([{ name: '../evil', mode: 0o644, data: Buffer.from('x') }]);

    await expect(unpackPayload(payload, join(dir, 'out'))).rejects.toThrow(/escapes/);
  });
});
