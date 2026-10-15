import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { extractTarGz } from '../../helpers/tar';
import { makeTmpDir, type TmpDir } from '../support/tmp';

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

  it('rejects unsupported entry types and non-gzip input as invalid archives', async () => {
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
