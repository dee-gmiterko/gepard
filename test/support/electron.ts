// Test-time stand-in for the `electron` module (aliased in vitest.config.ts).
// Main-process code only touches `electron` for `app.getPath('userData')`
// (src/main/paths.ts) and pushing IPC events to renderer windows
// (src/main/ipc/registry.ts's `emit`, via `BrowserWindow.getAllWindows()` +
// `webContents.send`). This mock points userData at a controllable directory
// and records every emitted event so tests can assert on both.

let userDataDir = '/tmp'

export interface EmittedEvent {
  channel: string
  payload: unknown
}

export const emittedEvents: EmittedEvent[] = []

/** Points `app.getPath('userData')` at `dir` for the rest of this test file. */
export function __setUserDataDir(dir: string): void {
  userDataDir = dir
}

export function __clearEmittedEvents(): void {
  emittedEvents.length = 0
}

const fakeWindow = {
  isDestroyed: () => false,
  webContents: {
    send: (channel: string, payload: unknown): void => {
      emittedEvents.push({ channel, payload })
    }
  }
}

export const app = {
  // src/main/log.ts mirrors log lines to stderr only when not packaged;
  // keep it quiet during tests.
  isPackaged: true,
  getPath(name: string): string {
    if (name === 'userData') return userDataDir
    return userDataDir
  },
  setName(): void {
    // no-op: tests set userDataDir directly instead of relying on app naming
  }
}

export const BrowserWindow = {
  getAllWindows: () => [fakeWindow],
  fromWebContents: () => null
}

export const ipcMain = {
  handle(): void {
    // not exercised by these tests: nothing under test calls registerHandlers
  }
}
