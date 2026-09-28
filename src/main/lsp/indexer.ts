import type { IndexStatus } from '@shared/ipc/schemas/lsp'
import { emit } from '../ipc/registry'
import { log } from '../log'
import { isNotifiableLevel, notifyMainFailure } from '../notify'
import { startLineIndex, type LineIndexHandle } from '../services/line-index-manager'
import { extensionRegistry } from '../extensions/registry'
import { LspSession, type ExtensionEvents, type FileChange, type LanguageSession } from './session'

interface ProjectState {
  status: IndexStatus
  session: LanguageSession | null
  lineIndex: LineIndexHandle | null
  pendingIndexChanges: FileChange[]
  pendingSessionChanges: FileChange[]
  lineIndexUnavailable: boolean
  sessionUnavailable: boolean
  latest: { sha: string; fileCount: number } | null
  initialHead: string
}

const projects = new Map<string, ProjectState>()

function setStatus(projectId: string, status: IndexStatus): void {
  const state = projects.get(projectId)
  if (state) state.status = status
  emit('index.status', { projectId, status })
}

function isCurrent(projectId: string, state: ProjectState): boolean {
  return projects.get(projectId) === state
}

function makeSink(projectId: string, extensionId: string, state: ProjectState): ExtensionEvents {
  const scope = `lsp:${extensionId}:${projectId}`
  return {
    status: (s) => {
      if (isCurrent(projectId, state)) setStatus(projectId, s)
    },
    log: (level, msg) => {
      if (isNotifiableLevel(level)) notifyMainFailure(scope, msg)
      else if (level === 'warn') log.warn(scope, msg)
      // LSP servers send frequent $/progress and window/logMessage notifications
      // at 'info' level.
    }
  }
}

async function disposeSession(projectId: string): Promise<void> {
  const session = projects.get(projectId)?.session
  if (!session) return
  await session.dispose().catch((e: Error) => {
    notifyMainFailure('lsp', `projectId=${projectId} dispose failed: ${e.message}`)
  })
}

async function disposeLineIndex(projectId: string): Promise<void> {
  const lineIndex = projects.get(projectId)?.lineIndex
  if (!lineIndex) return
  await lineIndex.dispose().catch((e: Error) => {
    notifyMainFailure('lsp', `projectId=${projectId} line index dispose failed: ${e.message}`)
  })
}

export const indexer: {
  open(projectId: string, repoRoot: string, files: string[], head: string): Promise<void>
  onCheckout(projectId: string, changes: FileChange[], newSha: string, fileCount: number): void
  close(projectId: string): Promise<void>
  status(projectId: string): IndexStatus
  session(projectId: string): LanguageSession | null
  lineIndex(projectId: string): LineIndexHandle | null
  currentSha(projectId: string): string | null
} = {
  async open(projectId, repoRoot, files, head): Promise<void> {
    await disposeSession(projectId)
    await disposeLineIndex(projectId)
    const state: ProjectState = {
      status: { state: 'indexing', phase: 'files', done: 0, total: files.length },
      session: null,
      lineIndex: null,
      pendingIndexChanges: [],
      pendingSessionChanges: [],
      lineIndexUnavailable: false,
      sessionUnavailable: false,
      latest: null,
      initialHead: head
    }
    projects.set(projectId, state)
    setStatus(projectId, { state: 'indexing', phase: 'files', done: 0, total: files.length })

    const lineIndex = await startLineIndex(
      repoRoot,
      files,
      (done, total) => {
        if (isCurrent(projectId, state))
          setStatus(projectId, { state: 'indexing', phase: 'files', done, total })
      },
      () => {
        if (isCurrent(projectId, state)) {
          state.lineIndex = null
          state.lineIndexUnavailable = true
          state.pendingIndexChanges = []
        }
      }
    )
    if (!isCurrent(projectId, state)) {
      await lineIndex?.dispose()
      return
    }
    if (lineIndex) {
      state.lineIndex = lineIndex
      if (state.pendingIndexChanges.length > 0) {
        lineIndex.applyChanges(state.pendingIndexChanges)
        state.pendingIndexChanges = []
      }
    }

    const extensions = await extensionRegistry.enabledLanguageExtensions()
    if (!isCurrent(projectId, state)) return

    const extension = extensions.find((ext) => files.some((f) => ext.matches(f)))
    if (!extension) {
      state.pendingSessionChanges = []
      state.sessionUnavailable = true
      setStatus(projectId, { state: 'idle' })
      return
    }

    setStatus(projectId, { state: 'indexing', phase: 'language', done: 0 })
    try {
      const sink = makeSink(projectId, extension.id, state)
      const plan = await extension.resolve({ root: repoRoot })
      const session = await LspSession.start(plan, sink)
      // Language servers load a project on the first request for one of its
      // files, and workspace/symbol returns nothing until then.
      const probe = files.find((f) => extension.matches(f) && !f.endsWith('.d.ts'))
      if (probe) {
        await session.lineSymbols(probe, 1).catch((e: Error) => {
          sink.log('warn', `project warm-up failed: ${e.message}`)
        })
      }
      if (!isCurrent(projectId, state)) {
        await session.dispose().catch((e: Error) => {
          notifyMainFailure(
            'lsp',
            `projectId=${projectId} stale session dispose failed: ${e.message}`
          )
        })
        return
      }
      state.session = session
      if (state.pendingSessionChanges.length > 0) {
        session.filesChanged(state.pendingSessionChanges)
        state.pendingSessionChanges = []
      }
      log.info('lsp', `projectId=${projectId} extension=${extension.id} session started`)
      setStatus(projectId, { state: 'idle' })
    } catch (e) {
      const message = (e as Error).message
      log.error(
        'lsp',
        `projectId=${projectId} extension=${extension.id} session start failed: ${message}`
      )
      if (!isCurrent(projectId, state)) return
      state.pendingSessionChanges = []
      state.sessionUnavailable = true
      setStatus(projectId, {
        state: 'error',
        message: `language session failed to start: ${message}`
      })
    }
  },

  onCheckout(projectId, changes, newSha, fileCount): void {
    const state = projects.get(projectId)
    if (!state) return
    state.latest = { sha: newSha, fileCount }
    if (state.session) state.session.filesChanged(changes)
    else if (!state.sessionUnavailable) state.pendingSessionChanges.push(...changes)
    if (state.lineIndex) state.lineIndex.applyChanges(changes)
    else if (!state.lineIndexUnavailable) state.pendingIndexChanges.push(...changes)
    if (state.status.state === 'idle') setStatus(projectId, { state: 'idle' })
  },

  async close(projectId): Promise<void> {
    await disposeSession(projectId).catch(() => {})
    await disposeLineIndex(projectId).catch(() => {})
    projects.delete(projectId)
  },

  status(projectId: string): IndexStatus {
    return projects.get(projectId)?.status ?? { state: 'indexing', phase: 'files', done: 0 }
  },

  session(projectId: string): LanguageSession | null {
    return projects.get(projectId)?.session ?? null
  },

  lineIndex(projectId: string): LineIndexHandle | null {
    return projects.get(projectId)?.lineIndex ?? null
  },

  currentSha(projectId: string): string | null {
    const state = projects.get(projectId)
    if (!state) return null
    return state.latest?.sha ?? state.initialHead
  }
}
