// Background symbol indexing entry point (report 03 §6): opens a project
// (starts a language session if an extension claims any of its files),
// re-indexes after a checkout (`filesChanged` with the paths git reports),
// and exposes the current per-project status and session. The git side
// (file list, head, changed paths) is computed by services/git.ts and
// passed in, so this module never spawns git itself.
//
// The extension list is a static array with the TypeScript extension,
// always enabled (spec: "Typescript one should be implemented and enabled
// by default").
import type { IndexStatus } from '@shared/ipc/schemas/index'
import { emit } from '../ipc/registry'
import { log } from '../log'
import { isNotifiableLevel, notifyMainFailure } from '../notify'
import { typescriptExtension } from './extensions/typescript'
import type { ExtensionEvents, FileChange, LanguageExtension, LanguageSession } from './session'

export type { FileChange }

const extensions: LanguageExtension[] = [typescriptExtension]

interface ProjectState {
  status: IndexStatus
  session: LanguageSession | null
}

const projects = new Map<string, ProjectState>()

function setStatus(projectId: string, status: IndexStatus): void {
  const state = projects.get(projectId)
  if (state) state.status = status
  emit('index.status', { projectId, status })
}

function makeSink(projectId: string, extensionId: string): ExtensionEvents {
  const scope = `lsp:${extensionId}:${projectId}`
  return {
    status: (s) => setStatus(projectId, s),
    log: (level, msg) => {
      // Crashes and failed restarts (session.ts) arrive here as 'error': a
      // background failure with no request or status change behind it, so it
      // must still reach the toast surface itself (coordinator spec).
      if (isNotifiableLevel(level)) notifyMainFailure(scope, msg)
      else if (level === 'warn') log.warn(scope, msg)
      // 'info' is dropped; the servers are chatty ($/progress, window/logMessage).
    }
  }
}

async function disposeSession(projectId: string): Promise<void> {
  const session = projects.get(projectId)?.session
  if (!session) return
  await session.dispose().catch((e: Error) => {
    // Not the result of a renderer request (the project is just being
    // closed/replaced) and nothing else surfaces this, so toast it too.
    notifyMainFailure('lsp', `projectId=${projectId} dispose failed: ${e.message}`)
  })
}

export const indexer: {
  open(projectId: string, repoRoot: string, files: string[], head: string): Promise<void>
  onCheckout(projectId: string, changes: FileChange[], newSha: string, fileCount: number): void
  close(projectId: string): Promise<void>
  status(projectId: string): IndexStatus
  session(projectId: string): LanguageSession | null
} = {
  /** Opens a project: starts the first extension whose `matches()` claims
   * any of its tracked files (spec: "Symbols only if LSP is added as
   * extension"). Never rejects: failures become an `error` status.
   * Idempotent: replaces any previous session. */
  async open(projectId, repoRoot, files, head): Promise<void> {
    await disposeSession(projectId)
    projects.set(projectId, {
      status: { state: 'indexing', phase: 'files', done: files.length, total: files.length },
      session: null
    })
    setStatus(projectId, {
      state: 'indexing',
      phase: 'files',
      done: files.length,
      total: files.length
    })

    const extension = extensions.find((ext) => files.some((f) => ext.matches(f)))
    if (!extension) {
      setStatus(projectId, { state: 'idle', commit: head, files: files.length })
      return
    }

    setStatus(projectId, { state: 'indexing', phase: 'language', done: 0 })
    try {
      const sink = makeSink(projectId, extension.id)
      const plan = await extension.resolve({ root: repoRoot })
      const session = await extension.start(plan, sink)
      // Servers load a project lazily, on the first request for one of its
      // files (report 03 §2.2/§4); until then workspace/symbol (the search
      // prefill) answers nothing. Touch one owned file to load its project;
      // a failure here only means the first real query loads it instead.
      const probe = files.find((f) => extension.matches(f) && !f.endsWith('.d.ts'))
      if (probe) {
        await session.lineSymbols(probe, 1).catch((e: Error) => {
          sink.log('warn', `project warm-up failed: ${e.message}`)
        })
      }
      const state = projects.get(projectId)
      if (state) state.session = session
      log.info('lsp', `projectId=${projectId} extension=${extension.id} session started`)
      setStatus(projectId, { state: 'idle', commit: head, files: files.length })
    } catch (e) {
      const message = (e as Error).message
      log.error(
        'lsp',
        `projectId=${projectId} extension=${extension.id} session start failed: ${message}`
      )
      setStatus(projectId, {
        state: 'error',
        message: `language session failed to start: ${message}`
      })
    }
  },

  /** After a checkout: push `filesChanged` to the language session (report
   * 03 §6) and publish the new file count. Search needs nothing (ripgrep is
   * spawned per query, always consistent with disk). */
  onCheckout(projectId, changes, newSha, fileCount): void {
    const state = projects.get(projectId)
    if (!state) return // not opened (yet): projects.open indexes from scratch
    state.session?.filesChanged(changes)
    // A session still starting (or failed to start) keeps its own status.
    if (state.status.state === 'idle')
      setStatus(projectId, { state: 'idle', commit: newSha, files: fileCount })
  },

  /** Stops the project's language session (project removed). */
  async close(projectId): Promise<void> {
    await disposeSession(projectId)
    projects.delete(projectId)
  },

  status(projectId: string): IndexStatus {
    // Not opened yet: projects.open is about to start it.
    return projects.get(projectId)?.status ?? { state: 'indexing', phase: 'files', done: 0 }
  },

  session(projectId: string): LanguageSession | null {
    return projects.get(projectId)?.session ?? null
  }
}
