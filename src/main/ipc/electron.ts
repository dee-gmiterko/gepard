import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { ChannelNameList, type ChannelName, type Envelope } from '@gepard/common';
import { dispatchChannel, type HandlerMap } from './dispatch';
import { addEventSink } from './registry';

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  return event.senderFrame != null && event.senderFrame === event.sender.mainFrame;
}

function registerChannel<C extends ChannelName>(name: C, handlers: HandlerMap): void {
  ipcMain.handle(name, async (event, raw: unknown): Promise<Envelope<unknown>> => {
    if (!isTrustedSender(event)) {
      return {
        ok: false,
        error: { code: 'FORBIDDEN', message: `${name} invoked from an untrusted frame` },
      };
    }
    const window = BrowserWindow.fromWebContents(event.sender);
    return dispatchChannel(handlers, name, raw, { window, remote: false });
  });
}

export function registerHandlers(handlers: HandlerMap): void {
  for (const name of ChannelNameList.options) registerChannel(name, handlers);
  addEventSink((name, payload) => {
    for (const w of BrowserWindow.getAllWindows())
      if (!w.isDestroyed()) w.webContents.send(name, payload);
  });
}
