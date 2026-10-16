import { mkdir, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createStaticApp } from '../../server/static';
import { makeTmpDir, type TmpDir } from '../support/tmp';

describe('createStaticApp', () => {
  let dir: TmpDir;
  let server: Server;
  let base: string;

  beforeAll(async () => {
    dir = await makeTmpDir('static');
    await mkdir(join(dir.path, 'assets'));
    await writeFile(
      join(dir.path, 'index.html'),
      '<!doctype html><html><head><title>Gepard</title></head></html>',
    );
    await writeFile(join(dir.path, 'assets', 'index-abc.js'), 'console.log(1)');
    server = createServer(createStaticApp(dir.path));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('no port');
    base = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await dir.cleanup();
  });

  it('serves index.html at the root without caching', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(await res.text()).toContain('Gepard');
  });

  it('serves assets as immutable with their mime type', async () => {
    const res = await fetch(`${base}/assets/index-abc.js?v=1`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/javascript');
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect(await res.text()).toBe('console.log(1)');
  });

  it('answers 404 for anything else', async () => {
    expect((await fetch(`${base}/missing.js`)).status).toBe(404);
    expect((await fetch(`${base}/..%2f..%2fetc%2fpasswd`)).status).toBe(404);
    expect((await fetch(`${base}/`, { method: 'POST' })).status).toBe(404);
  });
});
