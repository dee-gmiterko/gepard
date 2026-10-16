import type { BrowserWindow } from 'electron';
import { z } from 'zod';
import {
  ChannelNameList,
  channels,
  toIpcErrorShape,
  type ChannelName,
  type ChannelParsedInput,
  type ChannelOutput,
  type Envelope,
} from '@gepard/common';

export interface HandlerCtx {
  window: BrowserWindow | null;
  remote: boolean;
}

export type HandlerMap = {
  [C in ChannelName]: (
    input: ChannelParsedInput<C>,
    ctx: HandlerCtx,
  ) => Promise<ChannelOutput<C>> | ChannelOutput<C>;
};

export type Dispatcher = (channel: string, raw: unknown) => Promise<Envelope<unknown>>;

const inputSchemas: { [C in ChannelName]: { input: z.ZodType<ChannelParsedInput<C>> } } = channels;
const channelNames = new Set<string>(ChannelNameList.options);

function isChannelName(name: string): name is ChannelName {
  return channelNames.has(name);
}

export class IpcDispatchService {
  constructor(private readonly handlers: HandlerMap) {}

  dispatch(channel: string, raw: unknown, ctx: HandlerCtx): Promise<Envelope<unknown>> {
    if (!isChannelName(channel))
      return Promise.resolve({
        ok: false,
        error: { code: 'UNKNOWN_CHANNEL', message: `Unknown IPC channel: ${channel}` },
      });
    return this.run(channel, raw, ctx);
  }

  bind(ctx: HandlerCtx): Dispatcher {
    return (channel, raw) => this.dispatch(channel, raw, ctx);
  }

  private async run<C extends ChannelName>(
    name: C,
    raw: unknown,
    ctx: HandlerCtx,
  ): Promise<Envelope<unknown>> {
    const handler: (input: ChannelParsedInput<C>, ctx: HandlerCtx) => unknown = this.handlers[name];
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
      return { ok: true, value: await handler(parsed.data, ctx) };
    } catch (e) {
      return { ok: false, error: toIpcErrorShape(e) };
    }
  }
}
