import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { ChannelNameList, type Envelope } from '@gepard/common';
import type { IpcDispatchService } from './dispatch';
import type { IpcEventService } from './events';

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  return event.senderFrame != null && event.senderFrame === event.sender.mainFrame;
}

export function registerHandlers(dispatch: IpcDispatchService, events: IpcEventService): void {
  for (const name of ChannelNameList.options)
    ipcMain.handle(name, async (event, raw: unknown): Promise<Envelope<unknown>> => {
      if (!isTrustedSender(event)) {
        return {
          ok: false,
          error: { code: 'FORBIDDEN', message: `${name} invoked from an untrusted frame` },
        };
      }
      const window = BrowserWindow.fromWebContents(event.sender);
      return dispatch.dispatch(name, raw, { window, remote: false });
    });
  events.subscribe((name, payload) => {
    for (const w of BrowserWindow.getAllWindows())
      if (!w.isDestroyed()) w.webContents.send(name, payload);
  });
}
