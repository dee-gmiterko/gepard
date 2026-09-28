let userDataDir: string | null = null;

export interface EmittedEvent {
  channel: string;
  payload: unknown;
}

export const emittedEvents: EmittedEvent[] = [];

export function __setUserDataDir(dir: string): void {
  userDataDir = dir;
}

export function __clearEmittedEvents(): void {
  emittedEvents.length = 0;
}

const fakeWindow = {
  isDestroyed: () => false,
  webContents: {
    send: (channel: string, payload: unknown): void => {
      emittedEvents.push({ channel, payload });
    },
  },
};

export const app = {
  isPackaged: true,
  getPath(name: string): string {
    if (userDataDir === null) {
      throw new Error(
        `electron mock: app.getPath('${name}') called before __setUserDataDir() (test/support/electron.ts)`,
      );
    }
    return userDataDir;
  },
  setName: (): void => undefined,
};

export const BrowserWindow = {
  getAllWindows: () => [fakeWindow],
  fromWebContents: () => null,
};

export const ipcMain = {
  handle: (): void => undefined,
  on: (): void => undefined,
};
