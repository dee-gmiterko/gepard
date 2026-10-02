import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import {
  AppError,
  ChannelNameList,
  channels,
  type ChannelName,
  type ChannelParsedInput,
  type ChannelOutput,
  type Envelope,
  type EventName,
  type EventPayload,
  type IpcErrorShape,
} from '@gepard/common';

export interface HandlerCtx {
  event: IpcMainInvokeEvent;
  window: BrowserWindow | null;
}

export type HandlerMap = {
  [C in ChannelName]: (
    input: ChannelParsedInput<C>,
    ctx: HandlerCtx,
  ) => Promise<ChannelOutput<C>> | ChannelOutput<C>;
};

function toIpcError(e: unknown): IpcErrorShape {
  if (e instanceof AppError) return { code: e.code, message: e.message, details: e.details };
  if (e instanceof Error && e.name === 'AbortError')
    return { code: 'CANCELLED', message: e.message };
  if (e instanceof Error) return { code: 'INTERNAL', message: e.message };
  return { code: 'INTERNAL', message: String(e) };
}

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  return event.senderFrame != null && event.senderFrame === event.sender.mainFrame;
}

const inputSchemas: { [C in ChannelName]: { input: z.ZodType<ChannelParsedInput<C>> } } = channels;

function registerChannel<C extends ChannelName>(name: C, handlers: HandlerMap): void {
  const handler: (input: ChannelParsedInput<C>, ctx: HandlerCtx) => unknown = handlers[name];
  ipcMain.handle(name, async (event, raw: unknown): Promise<Envelope<unknown>> => {
    if (!isTrustedSender(event)) {
      return {
        ok: false,
        error: { code: 'FORBIDDEN', message: `${name} invoked from an untrusted frame` },
      };
    }
    const parsed = z.safeParse(inputSchemas[name].input, raw);
    if (!parsed.success)
      return {
        ok: false,
        error: {
          code: 'BAD_INPUT',
          message: z.prettifyError(parsed.error),
          details: parsed.error.issues,
        },
      };
    try {
      const ctx: HandlerCtx = { event, window: BrowserWindow.fromWebContents(event.sender) };
      return { ok: true, value: await handler(parsed.data, ctx) };
    } catch (e) {
      return { ok: false, error: toIpcError(e) };
    }
  });
}

export function registerHandlers(handlers: HandlerMap): void {
  for (const name of ChannelNameList.options) registerChannel(name, handlers);
}

export function emit<E extends EventName>(name: E, payload: EventPayload<E>): void {
  for (const w of BrowserWindow.getAllWindows())
    if (!w.isDestroyed()) w.webContents.send(name, payload);
}
