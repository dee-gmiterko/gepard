import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import type { LineIndexFileMatches } from './line-index'
import type {
  LineIndexFileChange,
  LineIndexRequest,
  LineIndexResponse
} from './line-index-protocol'

export type { LineIndexFileChange }

// Emitted by electron.vite.config.ts as its own main-process entry, next to
// index.js in out/main/ — a worker_threads Worker needs a real file on disk.
const WORKER_ENTRY = join(__dirname, 'line-index-worker.js')

export interface LineIndexHandle {
  queryExactLine(
    text: string,
    exclude?: { path: string; line: number }
  ): Promise<LineIndexFileMatches[]>
  queryWord(word: string): Promise<LineIndexFileMatches[]>
  /** Fire-and-forget: applied inside the worker in the background. ripgrep
   * rereads files from disk on every search, so it never goes stale on its
   * own; this cached index does, so it must be told about changes
   * explicitly. */
  applyChanges(changes: LineIndexFileChange[]): void
  dispose(): Promise<void>
}

export interface WorkerLike {
  postMessage(message: unknown): void
  on(event: 'message', listener: (message: LineIndexResponse) => void): void
  once(event: 'error' | 'exit', listener: (...args: unknown[]) => void): void
  terminate(): Promise<number> | void
}

export class LineIndexWorkerHandle implements LineIndexHandle {
  private nextId = 1
  private pending = new Map<number, (files: LineIndexFileMatches[]) => void>()
  private alive = true

  constructor(
    private readonly worker: WorkerLike,
    private readonly onDown: () => void
  ) {
    worker.on('message', (msg) => {
      if (msg.type !== 'result') return
      const resolve = this.pending.get(msg.id)
      if (!resolve) return
      this.pending.delete(msg.id)
      resolve(msg.files)
    })
    const handleDown = (): void => {
      if (!this.alive) return
      this.alive = false
      for (const resolve of this.pending.values()) resolve([])
      this.pending.clear()
      this.onDown()
    }
    worker.once('error', handleDown)
    worker.once('exit', handleDown)
  }

  private query(
    req: Extract<LineIndexRequest, { type: 'queryExactLine' | 'queryWord' }>
  ): Promise<LineIndexFileMatches[]> {
    if (!this.alive) return Promise.resolve([])
    return new Promise((resolve) => {
      this.pending.set(req.id, resolve)
      this.worker.postMessage(req)
    })
  }

  queryExactLine(
    text: string,
    exclude?: { path: string; line: number }
  ): Promise<LineIndexFileMatches[]> {
    return this.query({ type: 'queryExactLine', id: this.nextId++, text, exclude })
  }

  queryWord(word: string): Promise<LineIndexFileMatches[]> {
    return this.query({ type: 'queryWord', id: this.nextId++, word })
  }

  applyChanges(changes: LineIndexFileChange[]): void {
    if (!this.alive) return
    this.worker.postMessage({ type: 'update', changes } satisfies LineIndexRequest)
  }

  async dispose(): Promise<void> {
    if (!this.alive) return
    // Set before terminate(): terminate() fires the worker's own 'exit'
    // event, which would otherwise re-enter as if the worker had crashed and
    // call `onDown` a second time for an intentional close.
    this.alive = false
    this.pending.clear()
    await this.worker.terminate()
  }
}

export function startLineIndex(
  repoRoot: string,
  files: string[],
  onProgress: (done: number, total: number) => void,
  onDown: () => void
): Promise<LineIndexHandle> {
  return new Promise((resolve) => {
    const worker = new Worker(WORKER_ENTRY)
    const handle = new LineIndexWorkerHandle(worker, onDown)
    let settled = false
    const settle = (): void => {
      if (settled) return
      settled = true
      resolve(handle)
    }
    worker.on('message', (msg: LineIndexResponse) => {
      if (msg.type === 'progress') onProgress(msg.done, msg.total)
      else if (msg.type === 'built') settle()
    })
    worker.once('error', settle)
    worker.once('exit', settle)
    worker.postMessage({ type: 'build', repoRoot, files } satisfies LineIndexRequest)
  })
}
