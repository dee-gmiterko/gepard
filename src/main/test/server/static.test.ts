import { mkdir, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { join, sep } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createStaticHandler, resolveStaticPath } from '../../server/static';
import { makeTmpDir, type TmpDir } from '../support/tmp';

describe('resolveStaticPath', () => {
  const root = `${sep}srv${sep}renderer`;

  it('maps the root to index.html and keeps paths inside the root', () => {
    expect(resolveStaticPath(root, '/')).toBe(join(root, 'index.html'));
    expect(resolveStaticPath(root, '/assets/app.js')).toBe(join(root, 'assets', 'app.js'));
    expect(resolveStaticPath(root, '/a%20b.css')).toBe(join(root, 'a b.css'));
  });

  it('refuses to escape the root', () => {
    expect(resolveStaticPath(root, '/../secret')).toBeNull();
    expect(resolveStaticPath(root, '/assets/../../secret')).toBeNull();
    expect(resolveStaticPath(root, '/%2e%2e/secret')).toBeNull();
    expect(resolveStaticPath(root, '/a%00.js')).toBeNull();
    expect(resolveStaticPath(root, '/%zz')).toBeNull();
  });
});

describe('createStaticHandler', () => {
  let dir: TmpDir;
  let server: Server;
  let base: string;

  beforeAll(async () => {
    dir = await makeTmpDir('static');
    await mkdir(join(dir.path, 'assets'));
    await writeFile(join(dir.path, 'index.html'), '<!doctype html><title>Gepard</title>');
    await writeFile(join(dir.path, 'assets', 'index-abc.js'), 'console.log(1)');
    server = createServer((req, res) => void createStaticHandler(dir.path)(req, res));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('no port');
    base = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await dir.cleanup();
  });

  it('serves index.html at the root', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(await res.text()).toContain('Gepard');
  });

  it('serves files with their mime type', async () => {
    const res = await fetch(`${base}/assets/index-abc.js?v=1`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect(await res.text()).toBe('console.log(1)');
  });

  it('answers 404 for anything else', async () => {
    expect((await fetch(`${base}/missing.js`)).status).toBe(404);
    expect((await fetch(`${base}/assets`)).status).toBe(404);
    expect((await fetch(`${base}/..%2f..%2fetc%2fpasswd`)).status).toBe(404);
    expect((await fetch(`${base}/`, { method: 'POST' })).status).toBe(404);
  });
});
