import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parentPort } from 'node:worker_threads';
import { looksBinary } from '../helpers/fs/binary';
import { LineIndex } from './line-index';
import type {
  LineIndexFileChange,
  LineIndexRequest,
  LineIndexResponse,
} from './line-index-protocol';

if (!parentPort) {
  throw new Error('line-index-worker.ts must be run inside a worker_threads Worker');
}
const port = parentPort;

function post(msg: LineIndexResponse): void {
  port.postMessage(msg);
}

const index = new LineIndex();
let repoRoot = '';

const MAX_INDEXED_BYTES = 8 * 1024 * 1024;

async function indexOneFile(relPath: string): Promise<void> {
  try {
    const buf = await readFile(join(repoRoot, relPath));
    if (buf.length > MAX_INDEXED_BYTES || looksBinary(buf)) {
      index.removeFile(relPath);
      return;
    }
    index.setFile(relPath, buf.toString('utf8'));
  } catch {
    index.removeFile(relPath);
  }
}

async function build(files: string[]): Promise<void> {
  const total = files.length;
  const CHUNK = 200;
  let done = 0;
  for (let i = 0; i < total; i += CHUNK) {
    await Promise.all(files.slice(i, i + CHUNK).map(indexOneFile));
    done = Math.min(total, i + CHUNK);
    post({ type: 'progress', done, total });
  }
  post({ type: 'built' });
}

async function applyChanges(changes: LineIndexFileChange[]): Promise<void> {
  await Promise.all(
    changes.map((c) => (c.type === 'deleted' ? index.removeFile(c.path) : indexOneFile(c.path))),
  );
}

port.on('message', (msg: LineIndexRequest) => {
  switch (msg.type) {
    case 'build':
      repoRoot = msg.repoRoot;
      void build(msg.files);
      return;
    case 'update':
      void applyChanges(msg.changes);
      return;
    case 'queryExactLine':
      post({ type: 'result', id: msg.id, files: index.queryExactLine(msg.text, msg.exclude) });
      return;
    case 'queryWord':
      post({ type: 'result', id: msg.id, files: index.queryWord(msg.word) });
      return;
  }
});
