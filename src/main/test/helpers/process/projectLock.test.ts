import { spawn, type ChildProcess } from 'node:child_process';
import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectLocks } from '../../../helpers/process/projectLock';
import { makeTmpDir, type TmpDir } from '../../support/tmp';

const LOCK_MODULE = fileURLToPath(
  new URL('../../../helpers/process/projectLock.ts', import.meta.url),
);

describe('ProjectLocks (real files, sockets and processes)', () => {
  let dir: TmpDir;
  const children: ChildProcess[] = [];

  beforeEach(async () => {
    dir = await makeTmpDir('project-lock');
  });

  afterEach(async () => {
    for (const c of children.splice(0)) c.kill('SIGKILL');
    await dir.cleanup();
  });

  const exists = (path: string): Promise<boolean> =>
    access(path).then(
      () => true,
      () => false,
    );

  // A real separate process that acquires the lock and prints "held" (or "blocked").
  async function spawnHolder(projectId: string, linger = true): Promise<ChildProcess> {
    const script = `
      const { ProjectLocks } = await import(${JSON.stringify(LOCK_MODULE)});
      const locks = new ProjectLocks(${JSON.stringify(dir.path)}, () => console.log('focus-requested'));
      const r = await locks.acquire(${JSON.stringify(projectId)});
      console.log(r.acquired ? 'held' : 'blocked');
      ${linger ? 'setInterval(() => {}, 1000);' : ''}
    `;
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', script],
      { stdio: ['ignore', 'pipe', 'inherit'], cwd: process.cwd() },
    );
    children.push(child);
    await waitForLine(child, /held|blocked/);
    return child;
  }

  function waitForLine(child: ChildProcess, re: RegExp): Promise<string> {
    return new Promise((resolve, reject) => {
      let buf = '';
      child.stdout?.on('data', (chunk: Buffer) => {
        buf += chunk.toString();
        const m = re.exec(buf);
        if (m) resolve(m[0]);
      });
      child.once('exit', () => reject(new Error(`child exited early: ${buf}`)));
    });
  }

  it('acquires a free project, and releases it so another owner can take it', async () => {
    const a = new ProjectLocks(dir.path, () => undefined);
    const b = new ProjectLocks(dir.path, () => undefined);
    expect(await a.acquire('o__r')).toEqual({ acquired: true });
    expect(await exists(join(dir.path, 'o__r.lock'))).toBe(true);
    a.release('o__r');
    expect(await exists(join(dir.path, 'o__r.lock'))).toBe(false);
    expect(await b.acquire('o__r')).toEqual({ acquired: true });
    b.releaseAllSync();
  });

  it('acquiring a project this process already holds is idempotent', async () => {
    const a = new ProjectLocks(dir.path, () => undefined);
    await a.acquire('o__r');
    expect(await a.acquire('o__r')).toEqual({ acquired: true });
    a.releaseAllSync();
  });

  it('locks different projects independently', async () => {
    const holder = await spawnHolder('o__one');
    const mine = new ProjectLocks(dir.path, () => undefined);
    expect(await mine.acquire('o__two')).toEqual({ acquired: true });
    expect(await mine.acquire('o__one')).toEqual({ acquired: false, ownerPid: holder.pid });
    mine.releaseAllSync();
  });

  it('refuses a project held by another live process and reports its pid', async () => {
    const holder = await spawnHolder('o__r');
    const mine = new ProjectLocks(dir.path, () => undefined);
    expect(await mine.acquire('o__r')).toEqual({ acquired: false, ownerPid: holder.pid });
    expect(await mine.ownerOf('o__r')).toBe(holder.pid);
  });

  it('asks the owning process to focus its window', async () => {
    const holder = await spawnHolder('o__r');
    const focused = waitForLine(holder, /focus-requested/);
    const mine = new ProjectLocks(dir.path, () => undefined);
    expect(await mine.requestFocus('o__r')).toBe(true);
    await expect(focused).resolves.toBe('focus-requested');
  });

  it('reports a failed focus request when nobody owns the project', async () => {
    const mine = new ProjectLocks(dir.path, () => undefined);
    expect(await mine.requestFocus('o__nobody')).toBe(false);
  });

  it('takes over the lock of a crashed owner', async () => {
    const holder = await spawnHolder('o__r');
    holder.kill('SIGKILL');
    await new Promise((r) => holder.once('exit', r));
    expect(await exists(join(dir.path, 'o__r.lock'))).toBe(true);

    const mine = new ProjectLocks(dir.path, () => undefined);
    expect(await mine.ownerOf('o__r')).toBeNull();
    expect(await mine.acquire('o__r')).toEqual({ acquired: true });
    expect(JSON.parse(await readFile(join(dir.path, 'o__r.lock'), 'utf8'))).toEqual({
      pid: process.pid,
    });
    mine.releaseAllSync();
  });

  it('takes over a corrupt lock file', async () => {
    await writeFile(join(dir.path, 'o__r.lock'), 'garbage');
    const mine = new ProjectLocks(dir.path, () => undefined);
    expect(await mine.acquire('o__r')).toEqual({ acquired: true });
    mine.releaseAllSync();
  });

  it('removes its lock file when the owning process exits normally', async () => {
    const holder = await spawnHolder('o__r', false);
    await new Promise((r) => holder.once('exit', r));
    expect(await exists(join(dir.path, 'o__r.lock'))).toBe(false);
  });
});
