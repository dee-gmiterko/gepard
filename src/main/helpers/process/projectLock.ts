import { createConnection, createServer, type Server } from 'node:net';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { isErrnoException } from '@gepard/common';

interface LockFile {
  pid: number;
}

function isLockFile(value: unknown): value is LockFile {
  return (
    typeof value === 'object' && value !== null && 'pid' in value && typeof value.pid === 'number'
  );
}

export type LockResult = { acquired: true } | { acquired: false; ownerPid: number };

const FOCUS_MESSAGE = 'focus\n';
const FOCUS_TIMEOUT_MS = 1_000;

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return isErrnoException(e) && e.code === 'EPERM';
  }
}

// One lock file per project, holding the owner's pid. The owner also listens on
// a socket next to it so that another instance can ask it to show its window.
export class ProjectLocks {
  private readonly held = new Map<string, Server | null>();
  private exitHandler: (() => void) | null = null;

  constructor(
    private readonly dir: string,
    private readonly onFocusRequest: (projectId: string) => void,
  ) {}

  private lockPath(projectId: string): string {
    return join(this.dir, `${projectId}.lock`);
  }

  private socketPath(projectId: string): string {
    return process.platform === 'win32'
      ? `\\\\.\\pipe\\gepard-${projectId}-${Buffer.from(this.dir).toString('hex').slice(-24)}`
      : join(this.dir, `${projectId}.sock`);
  }

  private async readOwner(projectId: string): Promise<number | null> {
    let raw: string;
    try {
      raw = await readFile(this.lockPath(projectId), 'utf8');
    } catch (e) {
      if (isErrnoException(e) && e.code === 'ENOENT') return null;
      throw e;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      const pid = isLockFile(parsed) ? parsed.pid : null;
      return pid !== null && Number.isInteger(pid) && pid > 0 ? pid : null;
    } catch {
      return null;
    }
  }

  // Returns the pid of a live process other than this one that holds the lock.
  async ownerOf(projectId: string): Promise<number | null> {
    if (this.held.has(projectId)) return null;
    const pid = await this.readOwner(projectId);
    return pid !== null && isProcessAlive(pid) ? pid : null;
  }

  async acquire(projectId: string): Promise<LockResult> {
    if (this.held.has(projectId)) return { acquired: true };
    await mkdir(this.dir, { recursive: true });
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await writeFile(this.lockPath(projectId), JSON.stringify({ pid: process.pid }), {
          flag: 'wx',
        });
        this.held.set(projectId, await this.listen(projectId));
        this.installExitHandler();
        return { acquired: true };
      } catch (e) {
        if (!isErrnoException(e) || e.code !== 'EEXIST') throw e;
      }
      const owner = await this.readOwner(projectId);
      if (owner !== null && isProcessAlive(owner)) return { acquired: false, ownerPid: owner };
      await unlink(this.lockPath(projectId)).catch(() => undefined);
    }
    const owner = await this.readOwner(projectId);
    return { acquired: false, ownerPid: owner ?? 0 };
  }

  private listen(projectId: string): Promise<Server | null> {
    return new Promise((resolve) => {
      const path = this.socketPath(projectId);
      if (process.platform !== 'win32') {
        try {
          unlinkSync(path);
        } catch {
          // no stale socket
        }
      }
      const server = createServer((socket) => {
        socket.on('data', () => this.onFocusRequest(projectId));
        socket.on('error', () => undefined);
        socket.end();
      });
      server.once('error', () => resolve(null));
      server.listen(path, () => {
        server.unref();
        resolve(server);
      });
    });
  }

  // Best effort: asks the owner of the project to bring its window to the front.
  requestFocus(projectId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = createConnection(this.socketPath(projectId));
      const timer = setTimeout(() => done(false), FOCUS_TIMEOUT_MS);
      const done = (ok: boolean): void => {
        clearTimeout(timer);
        socket.destroy();
        resolve(ok);
      };
      socket.once('connect', () => socket.write(FOCUS_MESSAGE, () => done(true)));
      socket.once('error', () => done(false));
    });
  }

  heldProjects(): string[] {
    return [...this.held.keys()];
  }

  release(projectId: string): void {
    if (this.held.has(projectId)) this.releaseSync(projectId);
  }

  private releaseSync(projectId: string): void {
    const server = this.held.get(projectId);
    this.held.delete(projectId);
    server?.close();
    for (const path of [this.lockPath(projectId), this.socketPath(projectId)]) {
      if (process.platform === 'win32' && path.startsWith('\\\\')) continue;
      try {
        unlinkSync(path);
      } catch {
        // already gone
      }
    }
  }

  releaseAllSync(): void {
    for (const id of [...this.held.keys()]) this.releaseSync(id);
  }

  private installExitHandler(): void {
    if (this.exitHandler) return;
    this.exitHandler = (): void => this.releaseAllSync();
    process.once('exit', this.exitHandler);
  }
}
