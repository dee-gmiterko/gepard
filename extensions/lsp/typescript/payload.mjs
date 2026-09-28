import { chmod, mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

export function packPayload(entries) {
  const header = Buffer.from(
    JSON.stringify(entries.map(({ name, mode, data }) => ({ name, mode, size: data.length }))),
  );
  const headerLength = Buffer.alloc(4);
  headerLength.writeUInt32BE(header.length);
  return gzipSync(Buffer.concat([headerLength, header, ...entries.map(({ data }) => data)]));
}

export async function unpackPayload(payload, dir) {
  const raw = gunzipSync(payload);
  const headerEnd = 4 + raw.readUInt32BE(0);
  const files = JSON.parse(raw.subarray(4, headerEnd).toString('utf8'));
  let offset = headerEnd;
  for (const { name, mode, size } of files) {
    const target = path.join(dir, name);
    if (path.relative(dir, target).startsWith('..')) {
      throw new Error(`payload entry escapes its directory: ${name}`);
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, raw.subarray(offset, offset + size));
    await chmod(target, mode);
    offset += size;
  }
}
