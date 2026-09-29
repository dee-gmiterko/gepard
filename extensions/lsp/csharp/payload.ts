import { chmod, mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

export interface PayloadEntry {
  name: string;
  mode: number;
  data: Buffer;
}

export function packPayload(entries: PayloadEntry[]): Buffer {
  const header = Buffer.from(
    JSON.stringify(entries.map(({ name, mode, data }) => ({ name, mode, size: data.length }))),
  );
  const headerLength = Buffer.alloc(4);
  headerLength.writeUInt32BE(header.length);
  return gzipSync(Buffer.concat([headerLength, header, ...entries.map(({ data }) => data)]));
}

export async function unpackPayload(payload: Buffer, dir: string): Promise<void> {
  const raw = gunzipSync(payload);
  const headerEnd = 4 + raw.readUInt32BE(0);
  const files = JSON.parse(raw.subarray(4, headerEnd).toString('utf8')) as Array<{
    name: string;
    mode: number;
    size: number;
  }>;
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
