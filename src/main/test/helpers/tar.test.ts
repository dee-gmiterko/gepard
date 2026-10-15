import { execFile } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { extractTarGz } from '../../helpers/tar';
import { makeTmpDir, type TmpDir } from '../support/tmp';

const execFileAsync = promisify(execFile);

function tarEntry(name: string, data: Buffer, type = '0'): Buffer {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, 'utf8');
  header.write('0000644\0', 100, 8, 'utf8');
  header.write('0000000\0', 108, 8, 'utf8');
  header.write('0000000\0', 116, 8, 'utf8');
  header.write(data.length.toString(8).padStart(11, '0') + '\0', 124, 12, 'utf8');
  header.write('00000000000\0', 136, 12, 'utf8');
  header.write('        ', 148, 8, 'utf8');
  header.write(type, 156, 1, 'utf8');
  header.write('ustar\0', 257, 6, 'utf8');
  header.write('00', 263, 2, 'utf8');
  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'utf8');
  const padded = Buffer.alloc(Math.ceil(data.length / 512) * 512);
  data.copy(padded);
  return Buffer.concat([header, padded]);
}

function tarGz(entries: Buffer[]): Buffer {
  return gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)]));
}

describe('extractTarGz', () => {
  let tmp: TmpDir;

  afterEach(async () => {
    await tmp?.cleanup();
  });

  it('extracts an archive produced by tar, including long paths and modes', async () => {
    tmp = await makeTmpDir('tar');
    const src = join(tmp.path, 'src', 'pkg');
    const deep = join(src, 'a'.repeat(60), 'b'.repeat(60));
    await mkdir(deep, { recursive: true });
    await writeFile(join(src, 'package.json'), '{"name":"x"}');
    await writeFile(join(deep, 'file.txt'), 'deep');
    await writeFile(join(src, 'run.sh'), '#!/bin/sh\n', { mode: 0o755 });
    await writeFile(join(src, 'big.bin'), Buffer.alloc(100_000, 7));
    const archive = join(tmp.path, 'pkg.tar.gz');
    await execFileAsync('tar', ['-czf', archive, '-C', join(tmp.path, 'src'), 'pkg']);

    const dest = join(tmp.path, 'out');
    await extractTarGz(archive, dest);

    expect(await readFile(join(dest, 'pkg', 'package.json'), 'utf8')).toBe('{"name":"x"}');
    expect(
      await readFile(join(dest, 'pkg', 'a'.repeat(60), 'b'.repeat(60), 'file.txt'), 'utf8'),
    ).toBe('deep');
    expect((await readFile(join(dest, 'pkg', 'big.bin'))).equals(Buffer.alloc(100_000, 7))).toBe(
      true,
    );
    if (process.platform !== 'win32') {
      expect((await stat(join(dest, 'pkg', 'run.sh'))).mode & 0o111).not.toBe(0);
    }
  });

  it('rejects entries that escape the destination', async () => {
    tmp = await makeTmpDir('tar');
    const archive = join(tmp.path, 'evil.tar.gz');
    await writeFile(archive, tarGz([tarEntry('../escape.txt', Buffer.from('x'))]));
    await expect(extractTarGz(archive, join(tmp.path, 'out'))).rejects.toMatchObject({
      code: 'EXTENSION_INVALID_ARCHIVE',
    });
    await expect(stat(join(tmp.path, 'escape.txt'))).rejects.toThrow();
  });

  it('rejects symlinks and non-gzip input', async () => {
    tmp = await makeTmpDir('tar');
    const link = join(tmp.path, 'link.tar.gz');
    await writeFile(link, tarGz([tarEntry('pkg/link', Buffer.alloc(0), '2')]));
    await expect(extractTarGz(link, join(tmp.path, 'out1'))).rejects.toMatchObject({
      code: 'EXTENSION_INVALID_ARCHIVE',
    });

    const plain = join(tmp.path, 'plain.tar.gz');
    await writeFile(plain, 'not gzip at all');
    await expect(extractTarGz(plain, join(tmp.path, 'out3'))).rejects.toMatchObject({
      code: 'EXTENSION_INVALID_ARCHIVE',
    });
  });
});
