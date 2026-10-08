import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export interface Checksum {
  algorithm: 'sha256' | 'sha512';
  encoding: 'hex' | 'base64';
  digest: string;
}

export async function downloadVerified(
  url: string,
  file: string,
  checksum: Checksum,
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`download of ${url} failed: ${res.status} ${res.statusText}`);
  }
  const hash = createHash(checksum.algorithm);
  const hashing = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  await pipeline(res.body, hashing, createWriteStream(file));
  const actual = hash.digest(checksum.encoding);
  if (actual !== checksum.digest) {
    throw new Error(`checksum mismatch for ${url}: expected ${checksum.digest}, got ${actual}`);
  }
}
