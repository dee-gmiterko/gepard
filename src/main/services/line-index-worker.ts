// Runs inside a worker_threads Worker spawned by line-index-manager.ts, doing
// the index build/update/query work off the main thread so it does not block
// Electron's main-process IPC handling.
//
// worker_threads' `Worker` constructor needs a path to a real file, not an
// in-memory module value; the build emits this file next to index.js as
// `line-index-worker.js`, and line-index-manager.ts spawns it by that path.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parentPort } from 'node:worker_threads'
import { LineIndex } from './line-index'
import type {
  LineIndexFileChange,
  LineIndexRequest,
  LineIndexResponse
} from './line-index-protocol'

if (!parentPort) {
  throw new Error('line-index-worker.ts must be run inside a worker_threads Worker')
}
const port = parentPort

function post(msg: LineIndexResponse): void {
  port.postMessage(msg)
}

const index = new LineIndex()
let repoRoot = ''

const MAX_INDEXED_BYTES = 8 * 1024 * 1024

// Mirrors git's own heuristic for detecting binary content: a NUL byte
// within the first 8000 bytes.
function looksBinary(buf: Buffer): boolean {
  const len = Math.min(buf.length, 8000)
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true
  }
  return false
}

async function indexOneFile(relPath: string): Promise<void> {
  try {
    const buf = await readFile(join(repoRoot, relPath))
    if (buf.length > MAX_INDEXED_BYTES || looksBinary(buf)) {
      index.removeFile(relPath)
      return
    }
    index.setFile(relPath, buf.toString('utf8'))
  } catch {
    index.removeFile(relPath)
  }
}

async function build(files: string[]): Promise<void> {
  const total = files.length
  // worker_threads' `postMessage` has per-call overhead, so progress is
  // reported once per batch of concurrent reads rather than once per file.
  const CHUNK = 200
  let done = 0
  for (let i = 0; i < total; i += CHUNK) {
    await Promise.all(files.slice(i, i + CHUNK).map(indexOneFile))
    done = Math.min(total, i + CHUNK)
    post({ type: 'progress', done, total })
  }
  post({ type: 'built', fileCount: index.fileCount })
}

async function applyChanges(changes: LineIndexFileChange[]): Promise<void> {
  await Promise.all(
    changes.map((c) => (c.type === 'deleted' ? index.removeFile(c.path) : indexOneFile(c.path)))
  )
  post({ type: 'updated' })
}

port.on('message', (msg: LineIndexRequest) => {
  switch (msg.type) {
    case 'build':
      repoRoot = msg.repoRoot
      void build(msg.files)
      return
    case 'update':
      void applyChanges(msg.changes)
      return
    case 'queryExactLine':
      post({ type: 'result', id: msg.id, files: index.queryExactLine(msg.text, msg.exclude) })
      return
    case 'queryWord':
      post({ type: 'result', id: msg.id, files: index.queryWord(msg.word) })
      return
  }
})
