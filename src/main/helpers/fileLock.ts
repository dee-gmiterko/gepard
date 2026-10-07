import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { isErrnoException } from '@gepard/common';
import { isProcessAlive } from './process/projectLock';

const RETRY_DELAY_MS = 10;

const queues = new Map<string, Promise<unknown>>();

async function ownerPid(path: string): Promise<number | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (typeof parsed === 'object' && parsed !== null && 'pid' in parsed) {
      return typeof parsed.pid === 'number' ? parsed.pid : null;
    }
    return null;
  } catch {
    return null;
  }
}

async function acquire(path: string, token: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  for (;;) {
    try {
      await writeFile(path, JSON.stringify({ pid: process.pid, token }), { flag: 'wx' });
      return;
    } catch (e) {
      if (!isErrnoException(e) || e.code !== 'EEXIST') throw e;
    }
    const pid = await ownerPid(path);
    if (pid === null || !isProcessAlive(pid)) {
      await unlink(path).catch(() => undefined);
    } else {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

async function release(path: string, token: string): Promise<void> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (typeof parsed === 'object' && parsed !== null && 'token' in parsed) {
      if (parsed.token !== token) return;
    }
    await unlink(path);
  } catch {
    // already released or taken over
  }
}

export function withFileLock<T>(path: string, fn: () => Promise<T>): Promise<T> {
  const settledPrior = (queues.get(path) ?? Promise.resolve()).then(
    () => undefined,
    () => undefined,
  );
  const result = settledPrior.then(async () => {
    const token = randomUUID();
    await acquire(path, token);
    try {
      return await fn();
    } finally {
      await release(path, token);
    }
  });
  queues.set(
    path,
    result.then(
      () => undefined,
      () => undefined,
    ),
  );
  return result;
}
