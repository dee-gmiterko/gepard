import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { z } from 'zod';

const payloadHeaderSchema = z.array(
  z.object({ name: z.string(), mode: z.number(), size: z.number() }),
);

export interface PayloadEntry {
  name: string;
  mode: number;
  data: Buffer;
}

export async function collectFiles(
  dir: string,
  skip: (rel: string) => boolean = () => false,
  base = dir,
): Promise<PayloadEntry[]> {
  const entries: PayloadEntry[] = [];
  for (const name of (await fs.readdir(dir)).sort()) {
    const file = path.join(dir, name);
    const rel = path.relative(base, file);
    if (skip(rel)) continue;
    const info = await fs.stat(file);
    if (info.isDirectory()) {
      entries.push(...(await collectFiles(file, skip, base)));
    } else {
      entries.push({ name: rel, mode: info.mode & 0o777, data: await fs.readFile(file) });
    }
  }
  return entries;
}

export function packPayload(entries: PayloadEntry[]): Buffer {
  const header = Buffer.from(
    JSON.stringify(entries.map(({ name, mode, data }) => ({ name, mode, size: data.length }))),
  );
  const headerLength = Buffer.alloc(4);
  headerLength.writeUInt32BE(header.length);
  return zlib.gzipSync(Buffer.concat([headerLength, header, ...entries.map(({ data }) => data)]));
}

export async function unpackPayload(payload: Buffer, dir: string): Promise<void> {
  const raw = zlib.gunzipSync(payload);
  const headerEnd = 4 + raw.readUInt32BE(0);
  const files = payloadHeaderSchema.parse(JSON.parse(raw.subarray(4, headerEnd).toString('utf8')));
  let offset = headerEnd;
  for (const { name, mode, size } of files) {
    const target = path.join(dir, name);
    if (path.relative(dir, target).startsWith('..')) {
      throw new Error(`payload entry escapes its directory: ${name}`);
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, raw.subarray(offset, offset + size));
    await fs.chmod(target, mode);
    offset += size;
  }
}
