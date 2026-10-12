import { createReadStream } from 'node:fs';
import { mkdir, open, type FileHandle } from 'node:fs/promises';
import * as path from 'node:path';
import { createGunzip } from 'node:zlib';
import { AppError } from '@gepard/common';

const BLOCK = 512;

interface TarHeader {
  name: string;
  size: number;
  mode: number;
  type: string;
}

function field(header: Buffer, offset: number, length: number): string {
  const raw = header.subarray(offset, offset + length);
  const end = raw.indexOf(0);
  return raw.subarray(0, end === -1 ? raw.length : end).toString('utf8');
}

function numeric(header: Buffer, offset: number, length: number): number {
  const raw = header.subarray(offset, offset + length);
  // GNU base-256 encoding for sizes that do not fit the octal field.
  if (raw[0] & 0x80) {
    let value = 0;
    for (let i = 1; i < raw.length; i++) value = value * 256 + raw[i];
    return value;
  }
  const text = field(header, offset, length).trim();
  return text ? Number.parseInt(text, 8) : 0;
}

function parseHeader(block: Buffer): TarHeader {
  const magic = field(block, 257, 6);
  const prefix = magic.startsWith('ustar') ? field(block, 345, 155) : '';
  const base = field(block, 0, 100);
  return {
    name: prefix ? `${prefix}/${base}` : base,
    size: numeric(block, 124, 12),
    mode: numeric(block, 100, 8) & 0o777,
    type: String.fromCharCode(block[156] || 0x30),
  };
}

function parsePax(data: Buffer): Record<string, string> {
  const out: Record<string, string> = {};
  let offset = 0;
  while (offset < data.length) {
    const space = data.indexOf(0x20, offset);
    if (space === -1) break;
    const length = Number.parseInt(data.subarray(offset, space).toString('utf8'), 10);
    if (!Number.isFinite(length) || length <= 0) break;
    const record = data.subarray(space + 1, offset + length - 1).toString('utf8');
    const eq = record.indexOf('=');
    if (eq !== -1) out[record.slice(0, eq)] = record.slice(eq + 1);
    offset += length;
  }
  return out;
}

function safeRelativePath(name: string): string {
  const normalized = name
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/\/+$/, '');
  const segments = normalized.split('/').filter((s) => s !== '' && s !== '.');
  if (segments.length === 0 || segments.includes('..') || path.isAbsolute(normalized)) {
    throw new AppError('EXTENSION_INVALID_ARCHIVE', `archive entry has an unsafe path: ${name}`);
  }
  return segments.join('/');
}

export interface ExtractResult {
  files: string[];
}

class TarExtractor {
  private pending: Buffer = Buffer.alloc(0);
  private remaining = 0;
  private padding = 0;
  private handle: FileHandle | null = null;
  private longName: string | null = null;
  private paxPath: string | null = null;
  private meta: Buffer[] = [];
  private metaKind: 'L' | 'x' | null = null;
  private finished = false;
  readonly files: string[] = [];

  constructor(private readonly destDir: string) {}

  async push(chunk: Buffer): Promise<void> {
    this.pending = this.pending.length === 0 ? chunk : Buffer.concat([this.pending, chunk]);
    while (!this.finished) {
      if (this.remaining > 0) {
        if (this.pending.length === 0) return;
        const take = Math.min(this.remaining, this.pending.length);
        const data = this.pending.subarray(0, take);
        this.pending = this.pending.subarray(take);
        this.remaining -= take;
        if (this.handle) await this.handle.write(data);
        else if (this.metaKind) this.meta.push(Buffer.from(data));
        if (this.remaining === 0) await this.finishEntry();
        continue;
      }
      if (this.padding > 0) {
        if (this.pending.length === 0) return;
        const take = Math.min(this.padding, this.pending.length);
        this.pending = this.pending.subarray(take);
        this.padding -= take;
        continue;
      }
      if (this.pending.length < BLOCK) return;
      const block = this.pending.subarray(0, BLOCK);
      this.pending = this.pending.subarray(BLOCK);
      if (block.every((b) => b === 0)) {
        this.finished = true;
        return;
      }
      await this.startEntry(parseHeader(block));
    }
  }

  private async startEntry(header: TarHeader): Promise<void> {
    this.remaining = header.size;
    this.padding = (BLOCK - (header.size % BLOCK)) % BLOCK;
    const name = this.paxPath ?? this.longName ?? header.name;
    this.paxPath = null;
    this.longName = null;
    switch (header.type) {
      case 'L':
      case 'x':
        this.metaKind = header.type;
        this.meta = [];
        break;
      case 'g':
        this.metaKind = null;
        break;
      case '0':
      case '\0':
      case '7': {
        const rel = safeRelativePath(name);
        const target = path.join(this.destDir, rel);
        await mkdir(path.dirname(target), { recursive: true });
        this.handle = await open(target, 'w', header.mode || 0o644);
        this.files.push(rel);
        if (header.size === 0) await this.finishEntry();
        break;
      }
      case '5': {
        await mkdir(path.join(this.destDir, safeRelativePath(name)), { recursive: true });
        break;
      }
      default:
        throw new AppError(
          'EXTENSION_INVALID_ARCHIVE',
          `archive entry "${name}" has unsupported type ${JSON.stringify(header.type)}`,
        );
    }
  }

  private async finishEntry(): Promise<void> {
    if (this.handle) {
      const handle = this.handle;
      this.handle = null;
      await handle.close();
      return;
    }
    if (this.metaKind) {
      const data = Buffer.concat(this.meta);
      if (this.metaKind === 'L') this.longName = field(data, 0, data.length);
      else this.paxPath = parsePax(data).path ?? null;
      this.metaKind = null;
      this.meta = [];
    }
  }

  async close(): Promise<void> {
    const handle = this.handle;
    this.handle = null;
    if (handle) await handle.close();
  }

  get truncated(): boolean {
    return this.remaining > 0 || this.metaKind !== null;
  }
}

export async function extractTarGz(archivePath: string, destDir: string): Promise<ExtractResult> {
  await mkdir(destDir, { recursive: true });
  const extractor = new TarExtractor(destDir);
  const stream = createReadStream(archivePath).pipe(createGunzip());
  try {
    for await (const chunk of stream) {
      if (!Buffer.isBuffer(chunk)) throw new TypeError('gunzip emitted a non-buffer chunk');
      await extractor.push(chunk);
    }
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(
      'EXTENSION_INVALID_ARCHIVE',
      `could not read archive: ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    await extractor.close();
  }
  if (extractor.truncated) {
    throw new AppError('EXTENSION_INVALID_ARCHIVE', 'archive ended unexpectedly');
  }
  return { files: extractor.files };
}
